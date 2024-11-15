import { Circomkit } from "circomkit";
import { LeanIMT } from "@zk-kit/imt";
import { poseidon2 } from "poseidon-lite";
import {Scalar, ZqField} from "ffjavascript";

const SNARK_FIELD_SIZE = 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;
const F = new ZqField(Scalar.fromString(SNARK_FIELD_SIZE.toString()));
const BASE = F.e(2);

const circomkit = new Circomkit({
  "verbose": false,
  "inspect": true,
  "include": ["node_modules/circomlib/circuits", "node_modules/@zk-kit/circuits/circom"],
});

describe("privacy-token", () => {
  it("verifies a send/receive (both)", async () => {
    const MAX_DEPTH = 10;
    const MAX_AMOUNT_BITS = 19;
    const privateKey = 0x10644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;
    const publicKey = F.pow(BASE, privateKey);
    const encAmount1 = 123n;
    const ephemKey1 = 234n;
    const sendAmount2Nonce = 456n;
    const sendAmount2 = 223n;
    const {encryptedMessage: encAmount2, ephemeralKey: ephemKey2} = await asymmetricEncrypt(sendAmount2, publicKey, sendAmount2Nonce);
    const balance = 987n;
    const balanceNonce = 1234n;
    const newBalanceNonce = 1235n;
    const encryptedBalance = await symmetricEncrypt(balance, privateKey, balanceNonce);
    const sendAmount = balance + sendAmount2 - 1n;
    const sendNonce = 2345n;
    const recipPrivateKey = 0x20644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;
    const recipPubKey = F.pow(BASE, recipPrivateKey);
    const {encryptedMessage: encryptedAmountSent, ephemeralKey: sendEphemeralKey} = await asymmetricEncrypt(sendAmount, recipPubKey, sendNonce);
    const receiveTxHash = poseidon2([encAmount2, ephemKey2]);
    const receiveNullifier = poseidon2([receiveTxHash, privateKey]);
    const finalBalance = await symmetricEncrypt(balance + sendAmount2 - sendAmount, privateKey, newBalanceNonce);

    const tree = new LeanIMT((a, b) => poseidon2([a, b]));

    tree.insert(poseidon2([ encAmount1, ephemKey1 ]));
    tree.insert(poseidon2([ encAmount2, ephemKey2 ]));

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


    const circuit = await circomkit.WitnessTester(`privacytoken`, {
      file: "privacy-token",
      template: "PrivacyToken",
      dir: "test/privacy-token",
      params: [MAX_DEPTH, MAX_AMOUNT_BITS],
    });

    await circuit.expectPass({
      encryptedAmountReceived: encAmount2,
      ephemeralKeyReceived: ephemKey2,
      decodedAmountReceived: sendAmount2,
      treeDepth: tree.depth,
      treeIndices,
      treeSiblings,
      privateKey,
      encryptedBalance,
      balanceNonce,
      newBalanceNonce,
      sendAmount,
      sendNonce,
      recipPubKey,
      // This value will not be output in this test case because it is receiving
      nonReceivingTreeRoot: 0n,
    }, {
      treeRoot: tree.root,
      decryptedBalance: balance,
      decryptedAmountReceived: F.pow(BASE, sendAmount2),
      newBalanceRaw: balance + sendAmount2,
      encryptedAmountSent,
      sendEphemeralKey,
      finalBalanceRaw: balance + sendAmount2 - sendAmount,
      finalBalance,
      receiveNullifier,
    });
  });

  it("fails when send amount is zero and not receiving either", async () => {
    const MAX_DEPTH = 10;
    const MAX_AMOUNT_BITS = 19;
    const privateKey = 0x10644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;
    const publicKey = F.pow(BASE, privateKey);
    const encAmount1 = 123n;
    const ephemKey1 = 234n;
    const sendAmount2Nonce = 456n;
    const sendAmount2 = 223n;
    const {encryptedMessage: encAmount2, ephemeralKey: ephemKey2} = await asymmetricEncrypt(sendAmount2, publicKey, sendAmount2Nonce);
    const balance = 987n;
    const balanceNonce = 1234n;
    const newBalanceNonce = 1235n;
    const encryptedBalance = await symmetricEncrypt(balance, privateKey, balanceNonce);
    const sendAmount = 0n;
    const sendNonce = 2345n;
    const recipPrivateKey = 0x20644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;
    const recipPubKey = F.pow(BASE, recipPrivateKey);
    const {encryptedMessage: encryptedAmountSent, ephemeralKey: sendEphemeralKey} = await asymmetricEncrypt(sendAmount, recipPubKey, sendNonce);
    const receiveTxHash = poseidon2([encAmount2, ephemKey2]);
    const receiveNullifier = poseidon2([receiveTxHash, privateKey]);
    const finalBalance = await symmetricEncrypt(balance + sendAmount2 - sendAmount, privateKey, newBalanceNonce);

    const tree = new LeanIMT((a, b) => poseidon2([a, b]));

    tree.insert(poseidon2([ encAmount1, ephemKey1 ]));
    tree.insert(poseidon2([ encAmount2, ephemKey2 ]));

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


    const circuit = await circomkit.WitnessTester(`privacytoken`, {
      file: "privacy-token",
      template: "PrivacyToken",
      dir: "test/privacy-token",
      params: [MAX_DEPTH, MAX_AMOUNT_BITS],
    });

    await circuit.expectFail({
      encryptedAmountReceived: encAmount2,
      ephemeralKeyReceived: ephemKey2,
      decodedAmountReceived: sendAmount2,
      treeDepth: 0,
      treeIndices,
      treeSiblings,
      privateKey,
      encryptedBalance,
      balanceNonce,
      newBalanceNonce,
      sendAmount,
      sendNonce,
      recipPubKey,
      nonReceivingTreeRoot: 169n,
    });
  });

  it("fails when send amount is too large", async () => {
    const MAX_DEPTH = 10;
    const MAX_AMOUNT_BITS = 19;
    const privateKey = 0x10644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;
    const publicKey = F.pow(BASE, privateKey);
    const encAmount1 = 123n;
    const ephemKey1 = 234n;
    const sendAmount2Nonce = 456n;
    const sendAmount2 = 223n;
    const {encryptedMessage: encAmount2, ephemeralKey: ephemKey2} = await asymmetricEncrypt(sendAmount2, publicKey, sendAmount2Nonce);
    const balance = 987n;
    const balanceNonce = 1234n;
    const newBalanceNonce = 1235n;
    const encryptedBalance = await symmetricEncrypt(balance, privateKey, balanceNonce);
    const sendAmount = balance + sendAmount2 + 1n;
    const sendNonce = 2345n;
    const recipPrivateKey = 0x20644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;
    const recipPubKey = F.pow(BASE, recipPrivateKey);
    const {encryptedMessage: encryptedAmountSent, ephemeralKey: sendEphemeralKey} = await asymmetricEncrypt(sendAmount, recipPubKey, sendNonce);
    const receiveTxHash = poseidon2([encAmount2, ephemKey2]);
    const receiveNullifier = poseidon2([receiveTxHash, privateKey]);
    const finalBalance = await symmetricEncrypt(balance + sendAmount2 - sendAmount, privateKey, newBalanceNonce);

    const tree = new LeanIMT((a, b) => poseidon2([a, b]));

    tree.insert(poseidon2([ encAmount1, ephemKey1 ]));
    tree.insert(poseidon2([ encAmount2, ephemKey2 ]));

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


    const circuit = await circomkit.WitnessTester(`privacytoken`, {
      file: "privacy-token",
      template: "PrivacyToken",
      dir: "test/privacy-token",
      params: [MAX_DEPTH, MAX_AMOUNT_BITS],
    });

    await circuit.expectFail({
      encryptedAmountReceived: encAmount2,
      ephemeralKeyReceived: ephemKey2,
      decodedAmountReceived: sendAmount2,
      treeDepth: tree.depth,
      treeIndices,
      treeSiblings,
      privateKey,
      encryptedBalance,
      balanceNonce,
      newBalanceNonce,
      sendAmount,
      sendNonce,
      recipPubKey,
      // This value will not be output in this test case because it is receiving
      nonReceivingTreeRoot: 0n,
    });
  });

  it("verifies a send without receive", async () => {
    const MAX_DEPTH = 10;
    const MAX_AMOUNT_BITS = 19;
    const privateKey = 0x10644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;
    const publicKey = F.pow(BASE, privateKey);
    const encAmount1 = 123n;
    const ephemKey1 = 234n;
    const sendAmount2Nonce = 456n;
    const sendAmount2 = 223n;
    const {encryptedMessage: encAmount2, ephemeralKey: ephemKey2} = await asymmetricEncrypt(sendAmount2, publicKey, sendAmount2Nonce);
    const balance = 987n;
    const balanceNonce = 1234n;
    const newBalanceNonce = 1235n;
    const encryptedBalance = await symmetricEncrypt(balance, privateKey, balanceNonce);
    // different sendAmount than 'both' test case
    const sendAmount = balance;
    const sendNonce = 2345n;
    const recipPrivateKey = 0x20644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;
    const recipPubKey = F.pow(BASE, recipPrivateKey);
    const {encryptedMessage: encryptedAmountSent, ephemeralKey: sendEphemeralKey} = await asymmetricEncrypt(sendAmount, recipPubKey, sendNonce);
    const receiveTxHash = poseidon2([encAmount2, ephemKey2]);
    const receiveNullifier = poseidon2([receiveTxHash, privateKey]);
    const nonReceivingTreeRoot = 169n;
    const finalBalance = await symmetricEncrypt(balance - sendAmount, privateKey, newBalanceNonce);

    const tree = new LeanIMT((a, b) => poseidon2([a, b]));

    tree.insert(poseidon2([ encAmount1, ephemKey1 ]));
    tree.insert(poseidon2([ encAmount2, ephemKey2 ]));

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


    const circuit = await circomkit.WitnessTester(`privacytoken`, {
      file: "privacy-token",
      template: "PrivacyToken",
      dir: "test/privacy-token",
      params: [MAX_DEPTH, MAX_AMOUNT_BITS],
    });

    await circuit.expectPass({
      encryptedAmountReceived: encAmount2,
      ephemeralKeyReceived: ephemKey2,
      decodedAmountReceived: sendAmount2,
      // disabled receiving with treeDepth=0
      treeDepth: 0,
      treeIndices,
      treeSiblings,
      privateKey,
      encryptedBalance,
      balanceNonce,
      newBalanceNonce,
      sendAmount,
      sendNonce,
      recipPubKey,
      // This value will be output in this test case because it is NOT receiving
      nonReceivingTreeRoot,
    }, {
      treeRoot: nonReceivingTreeRoot,
      decryptedBalance: balance,
      decryptedAmountReceived: F.pow(BASE, sendAmount2),
      newBalanceRaw: balance,
      encryptedAmountSent,
      sendEphemeralKey,
      finalBalanceRaw: balance - sendAmount,
      finalBalance,
      receiveNullifier,
    });
  });
});

describe("encryption-asymmetric", () => {
  it("encrypt-decrypt", async () => {
    const circuitDecrypt = await circomkit.WitnessTester(`asymmetricdecrypt`, {
      file: "encryption-asymmetric",
      template: "AsymmetricDecrypt",
      dir: "test/encryption-asymmetric",
    });

    const secret = 123456n;
    const privateKey = 0x10644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;
    const publicKey = F.pow(BASE, privateKey);
    const nonce = 34567n;

    // Can encrypt and decrypt back to the same value
    const {encryptedMessage, ephemeralKey} = await asymmetricEncrypt(secret, publicKey, nonce);
    await circuitDecrypt.expectPass(
      { encryptedMessage, ephemeralKey, privateKey },
      // decrypted value is encoded
      { decryptedMessage: F.pow(BASE, secret) }
    );
  });
});

async function asymmetricEncrypt(secret, publicKey, nonce) {
  const circuitEncrypt = await circomkit.WitnessTester(`asymmetricencrypt`, {
    file: "encryption-asymmetric",
    template: "AsymmetricEncrypt",
    dir: "test/encryption-asymmetric",
  });
  return await circuitEncrypt.compute(
    {secret, publicKey, nonce},
    ['encryptedMessage', 'ephemeralKey']
  );
}

async function symmetricEncrypt(message, key, nonce) {
  const circuitEncrypt = await circomkit.WitnessTester(`symmetricencrypt`, {
    file: "encryption-symmetric",
    template: "SymmetricEncrypt",
    dir: "test/encryption-symmetric",
  });
  const {encryptedMessage} = await circuitEncrypt.compute({message, key, nonce}, ['encryptedMessage']);
  return encryptedMessage;
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
    const encryptedMessage = await symmetricEncrypt(message, key, nonce);
    await circuitDecrypt.expectPass({ encryptedMessage, key, nonce }, { message });
  });
});

describe("control-flow", () => {
  it("if-else", async () => {
    const circuit = await circomkit.WitnessTester(`ifelse`, {
      file: "control-flow",
      template: "IfElse",
      dir: "test/control-flow",
    });

    await circuit.expectPass({ cond: 0, ifTrue: 123, ifFalse: 789 }, { out: 789 });
    await circuit.expectPass({ cond: 1, ifTrue: 123, ifFalse: 789 }, { out: 123 });
  });

  it("switch", async () => {
    const circuit = await circomkit.WitnessTester(`switch`, {
      file: "control-flow",
      template: "Switch",
      dir: "test/control-flow",
    });

    await circuit.expectPass({ cond: 0, in: [123, 789] }, { out: [123, 789] });
    await circuit.expectPass({ cond: 1, in: [123, 789] }, { out: [789, 123] });
  });
});
