import { Circomkit } from "circomkit";
import { LeanIMT } from "@zk-kit/imt";
import { poseidon6, poseidon5, poseidon2, poseidon1 } from "poseidon-lite";

import {
  randomBigInt,
} from '../src/rsa.js';

const circomkit = new Circomkit({
  "verbose": process.env.VERBOSE,
  "inspect": true,
  "include": [
    "node_modules",
    "node_modules/circomlib/circuits",
    "node_modules/@zk-kit/circuits/circom",
  ],
});

let circuit;

const MAX_VAL = (1n << 252n) - 1n;
const UINT160 = (1n << 160n) - 1n;
const UINT32 = (1n << 32n) - 1n;
const MAX_DEPTH = 20;

describe("poseidon-privacy-token", () => {
  // default case is a private receive
  it("verifies a receive", runCase(input => true));
  it("verifies an initial receive", runCase(input => {
    // special value in runCase
    input.oldBalance = 0n;
    return true;
  }));
  it("verifies a receive beyond the balance", runCase(input => {
    input.sendAmount = input.oldBalance + 1n;
    return true;
  }));

  it("verifies a send", runCase(input => {
    input.recipPublicKey = randomBigInt(MAX_VAL);
    return true;
  }));
  it("verifies a send of the full balance", runCase(input => {
    input.recipPublicKey = randomBigInt(MAX_VAL);
    input.sendAmount = input.oldBalance;
    return true;
  }));
  it("fails to verify a send beyond the balance", runCase(input => {
    input.recipPublicKey = randomBigInt(MAX_VAL);
    input.sendAmount = input.oldBalance + 1n;
    return false;
  }));
  it("verifies a mint", runCase(input => {
    // Input includes the fake receive transaction
    // the contract will ignore the balance changes and send hash
    // This recipPublicKey is the msg.sender to the contract
    input.recipPublicKey = randomBigInt(UINT160);
    input.publicMode = 1;
    return true;
  }));
  it("verifies a burn", runCase(input => {
    // Input includes the fake send transaction hash
    // the contract will ignore the send hash
    // This recipPublicKey is the address of the recipient of the tokens
    input.recipPublicKey = randomBigInt(UINT160);
    input.publicMode = 2;
    return true;
  }));
});

// Default case is to receive
function runCase(callback) {
  return async () => {
    const tokenAddr = randomBigInt(UINT160);
    const chainId = randomBigInt(UINT32);
    const myPrivateKey = randomBigInt(MAX_VAL);
    const treeRootIfSend = randomBigInt(MAX_VAL);
    const fakeReceiveHash = randomBigInt(MAX_VAL);
    const sendBlinding = randomBigInt(MAX_VAL);
    const oldBalanceNonce = randomBigInt(MAX_VAL);
    const newBalanceNonce = randomBigInt(MAX_VAL);
    const myPublicKey = poseidon1([ myPrivateKey ]);
    const recipPublicKey = myPublicKey;
    const oldBalance = 90000000000n;
    const sendAmount = 1234568n;

    const preInput = {
      recipPublicKey,
      oldBalance,
      sendAmount,
      publicMode: 0,
    };
    // Customize the input for this test case in the callback
    const expectPass = callback(preInput);

    const isReceive = myPublicKey === preInput.recipPublicKey;
    const isPrivate = preInput.publicMode === 0;
    const isMint = preInput.publicMode === 1;
    const isBurn = preInput.publicMode === 2;
    const newBalance = preInput.oldBalance + preInput.sendAmount * (isReceive ? 1n : -1n);

    circuit = circuit || await circomkit.WitnessTester(`privtokenposeidon`, {
      file: "privacy-token-poseidon",
      template: "PrivacyToken_Poseidon",
      dir: "test/privtokenposeidon",
      params: [252, MAX_DEPTH],
    });

    const input = {
      sendAmount: preInput.sendAmount,
      recipPublicKey: preInput.recipPublicKey,
      publicMode: preInput.publicMode,
      encryptedBalance: preInput.oldBalance === 0n ? 0n :
        symmetricEncrypt(oldBalance, myPrivateKey, oldBalanceNonce),
      oldBalanceNonce,
      newBalanceNonce,
      tokenAddr,
      chainId,
      sendBlinding,
      myPrivateKey,
      fakeReceiveHash,
      treeRootIfSend,
      treeIndex: randomBigInt(MAX_VAL),
    };

    const { treeSiblings, treeIndices, treeDepth, treeRoot } = genTree([
      poseidon2([ 123n, 456n ]), // first item doesn't matter
      txHash(input), // genTree uses this second item
    ]);

    Object.assign(input, {
      treeDepth,
      treeIndices,
      treeSiblings,
    });

    const output = {
      newBalance: symmetricEncrypt(newBalance, myPrivateKey, newBalanceNonce),
      hash: isReceive ? fakeReceiveHash : txHash(input),
      receiveNullifier: nullifier(input),
      treeRoot: isReceive ? treeRoot : treeRootIfSend,
      publicTokenAddr: isPrivate ? 0 : input.tokenAddr,
      publicAddress: isPrivate ? 0 : input.recipPublicKey,
      publicAmount: isPrivate ? 0 : input.sendAmount,
      myPublicKey,
    };
    if(expectPass) {
      await circuit.expectPass(input, output);
    } else {
      await circuit.expectFail(input);
    }
  };
};

function genTree(items) {
  const tree = new LeanIMT((a, b) => poseidon2([a, b]));

  items.forEach(item => tree.insert(item));

  // This test function always selects the second leaf for the proof
  const { siblings: treeSiblings, index } = tree.generateProof(1);

  // The index must be converted to a list of indices, 1 for each tree level.
  // The circuit tree depth is 20, so the number of siblings must be 20, even if
  // the tree depth is actually 3. The missing siblings can be set to 0, as they
  // won't be used to calculate the root in the circuit.
  const treeIndices = [];

  for (let i = 0; i < MAX_DEPTH; i += 1) {
      treeIndices.push((index >> i) & 1);

      if (treeSiblings[i] === undefined) {
          treeSiblings[i] = BigInt(0);
      }
  }

  return { treeSiblings, treeIndices, treeDepth: tree.depth, treeRoot: tree.root };
}

function txHash(input) {
  return poseidon5([
    input.tokenAddr,
    input.chainId,
    input.sendAmount,
    input.sendBlinding,
    input.recipPublicKey,
  ]);
}

function nullifier(input) {
  return poseidon6([
    input.tokenAddr,
    input.chainId,
    input.sendAmount,
    input.sendBlinding,
    input.recipPublicKey,
    input.myPrivateKey,
  ]);
}

function symmetricEncrypt(message, key, nonce) {
  return poseidon2([key, nonce]) + message;
}
