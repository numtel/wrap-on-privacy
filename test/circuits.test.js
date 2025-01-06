import { Circomkit } from "circomkit";
import { LeanIMT } from "@zk-kit/imt";
import { poseidon2 } from "poseidon-lite";
import NTRU, {
  expandArray,
  trimPolynomial,
  bigintToBits,
  bitsToBigInt,
  packOutput,
  unpackInput,
} from "ntru-circom";

const SNARK_FIELD_SIZE = 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;

const circomkit = new Circomkit({
  "verbose": process.env.VERBOSE,
  "inspect": true,
  "include": [
    "node_modules",
    "node_modules/circomlib/circuits",
    "node_modules/@zk-kit/circuits/circom",
    "node_modules/ntru-circom/circuits",
  ],
});

const ntru = new NTRU({
  // very small keys, not secure, but fast
  N: 17,
  q: 32,
  df: 3,
  dg: 2,
  dr: 2,
});
ntru.generatePrivateKeyF();
ntru.generateNewPublicKeyGH();

const MAX_DEPTH = 32n;
const MAX_AMOUNT_BITS = 252n;
const MAX_SEND_AMOUNT = 2n ** BigInt(Math.min(252, ntru.N));


describe("privacy-token", () => {
  [
    {
      label: "verifies a send/receive (both)",
      async handler(circuit, input, output) {
        await circuit.expectPass(input, output);
      },
      receiveAmount: 223n,
      balance: 987n,
      sendAmount: 987n + 223n - 1n,
    },
    {
      label: "fails when send amount is zero and not receiving either",
      async handler(circuit, input, output) {
        input.isReceiving = 0;
        await circuit.expectFail(input);
      },
      receiveAmount: 223n,
      balance: 987n,
      sendAmount: 0n,
    },
    {
      label: "fails when send amount is too large",
      async handler(circuit, input, output) {
        await circuit.expectFail(input);
      },
      receiveAmount: 223n,
      balance: 987n,
      sendAmount: 987n + 223n + 1n,
    },
    {
      label: "verifies a send without a receive",
      async handler(circuit, input, output) {
        input.isReceiving = 0;
        input.nonReceivingTreeRoot = output.treeRoot = 123456n;
        await circuit.expectPass(input, output);
      },
      receiveAmount: 0n,
      balance: 987n,
      sendAmount: 987n - 1n,
    },
    {
      label: "verifies a burn",
      async handler(circuit, input, output) {
        input.isBurn = 1;
        output.encryptedAmountSent[0] = 1n; // magic number to signify a burn
        output.encryptedAmountSent[1] = 987n - 1n; // sendAmount
        input.burnAddress = output.encryptedAmountSent[2] = 123789n;
        await circuit.expectPass(input, output);
      },
      receiveAmount: 10n,
      balance: 987n,
      sendAmount: 987n - 1n,
    },
  ].forEach(thisCase => {
    it(thisCase.label, async () => {
      const receiveEncrypted = ntru.encryptBits(bigintToBits(thisCase.receiveAmount));
      const receivePacked = packOutput(ntru.q, ntru.N+1, receiveEncrypted.inputs.remainderE);
      const receiveDecrypted = ntru.decryptBits(receiveEncrypted.value);
      const receiveTxHash = calcMultiHash(receivePacked.expected);

      // privkey for balance symmetric encryption is packed+summed f
      const privKeyPacked = packOutput(3, ntru.N, receiveDecrypted.inputs.f.map(x=>x===ntru.q-1 ? 2 : x));
      const privateKey = privKeyPacked.expected.reduce((sum, cur) => sum + cur, 0n) % SNARK_FIELD_SIZE;
      const receiveNullifier = poseidon2([receiveTxHash, privateKey]);
      // pubkey for encrypted balance storage is hash of the packed f
      const publicKey = calcMultiHash(privKeyPacked.expected);

      const balanceNonce = 1234n;
      const newBalanceNonce = 1235n;
      const encryptedBalance = symmetricEncrypt(thisCase.balance, privateKey, balanceNonce);
      const finalBalance = symmetricEncrypt(
        thisCase.balance + thisCase.receiveAmount - thisCase.sendAmount,
        privateKey,
        newBalanceNonce
      );

      const sendEncrypted = ntru.encryptBits(bigintToBits(thisCase.sendAmount));
      const sendPacked = packOutput(ntru.q, ntru.N+1, sendEncrypted.inputs.remainderE);
      const sendUnpacked = unpackInput(ntru.q, sendPacked.maxOutputBits, sendPacked.expected);

      const verifyKeys = ntru.verifyKeysInputs();

      const { treeSiblings, treeIndices, treeDepth, treeRoot } = genTree([
        poseidon2([ 123n, 456n ]), // first item doesn't matter
        receiveTxHash, // genTree uses this second item
      ]);

      const params = [
        MAX_DEPTH,
        MAX_AMOUNT_BITS,
        MAX_SEND_AMOUNT,
        ntru.q,
        ntru.calculateNq(),
        ntru.p,
        ntru.calculateNp(),
        ntru.N,
        sendPacked.maxInputBits,
        sendPacked.maxOutputBits,
        sendPacked.outputSize,
        sendPacked.arrLen,
        privKeyPacked.outputSize,
      ];
      const circuit = await circomkit.WitnessTester(`privacytoken`, {
        file: "privacy-token",
        template: "PrivacyToken",
        dir: "test/privacy-token",
        params,
      });
      const input = {
        tokenAddr: 123,
        chainId: 234,
        encryptedReceive: receivePacked.expected,
        f: receiveDecrypted.inputs.f,
        fp: receiveDecrypted.inputs.fp,
        quotientFp: verifyKeys.fp.inputs.quotientI,
        remainderFp: verifyKeys.fp.inputs.remainderI,
        receiveQuotient1: receiveDecrypted.inputs.quotient1,
        receiveRemainder1: receiveDecrypted.inputs.remainder1,
        receiveQuotient2: receiveDecrypted.inputs.quotient2,
        receiveRemainder2: receiveDecrypted.inputs.remainder2,
        treeDepth,
        treeIndices,
        treeSiblings,
        encryptedBalance,
        balanceNonce,
        newBalanceNonce,
        sendAmount: thisCase.sendAmount,
        recipH: sendEncrypted.inputs.h,
        sendR: sendEncrypted.inputs.r,
        sendQuotient: sendEncrypted.inputs.quotientE,
        sendRemainder: sendEncrypted.inputs.remainderE,
        burnAddress: 0,
        isBurn: 0,
        isReceiving: 1,
        // This value will not be output when it is receiving
        nonReceivingTreeRoot: 0n,
      };
      const output = {
        publicKey,
        treeRoot,
        encryptedAmountSent: sendPacked.expected,
        finalBalance,
        receiveNullifier,
      };
      await thisCase.handler(circuit, input, output);
    });
  });

  it("verifies a mint", async () => {
    const sendAmount = MAX_SEND_AMOUNT - 3n;
    const encrypted = ntru.encryptBits(bigintToBits(sendAmount));
    const sendPacked = packOutput(ntru.q, ntru.N+1, encrypted.inputs.remainderE);

    const params = [
      MAX_AMOUNT_BITS,
      MAX_SEND_AMOUNT,
      ntru.q,
      ntru.calculateNq(),
      ntru.N,
      sendPacked.maxInputBits,
      sendPacked.maxOutputBits,
      sendPacked.outputSize,
      sendPacked.arrLen,
    ];
    const circuit = await circomkit.WitnessTester(`privatemint`, {
      file: "privacy-token",
      template: "PrivateMint",
      dir: "test/privacy-token",
      params,
    });
    const inputs = {
      tokenAddr: 123,
      chainId: 234,
      sendAmount,
      recipH: encrypted.inputs.h,
      sendR: encrypted.inputs.r,
      quotientE: encrypted.inputs.quotientE,
      remainderE: encrypted.inputs.remainderE,
    };
    await circuit.expectPass(inputs, {
      encryptedSend: sendPacked.expected,
    });
  });

});

function calcMultiHash(input) {
  let hash = poseidon2([input[0], input[1]]);
  for(let i = 2; i<input.length; i++) {
    hash = poseidon2([hash, input[i]]);
  }
  return hash;
}

function genTree(items) {
  const tree = new LeanIMT((a, b) => poseidon2([a, b]));

  items.forEach(item => tree.insert(item));

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

function symmetricEncrypt(message, key, nonce) {
  return poseidon2([key, nonce]) + message;
}

describe("encryption-symmetric", () => {
  it("encrypt-decrypt", async () => {
    const circuitDecrypt = await circomkit.WitnessTester(`symmetricdecrypt`, {
      file: "encryption-symmetric",
      template: "SymmetricDecrypt",
      dir: "test/encryption-symmetric",
    });

    const message = 123456n;
    const key = 23456n;
    const nonce = 34567n;

    // Can encrypt and decrypt back to the same value
    const encryptedMessage = symmetricEncrypt(message, key, nonce);
    await circuitDecrypt.expectPass({ encryptedMessage, key, nonce }, { message });
  });
});
