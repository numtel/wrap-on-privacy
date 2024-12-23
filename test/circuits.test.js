import { Circomkit } from "circomkit";
import { LeanIMT } from "@zk-kit/imt";
import { poseidon2 } from "poseidon-lite";
import {Scalar, ZqField} from "ffjavascript";
import NTRU, {expandArray, trimPolynomial} from "ntru-circom";

const SNARK_FIELD_SIZE = 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;
const F = new ZqField(Scalar.fromString(SNARK_FIELD_SIZE.toString()));
const BASE = F.e(2);

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
//       N: 701,
//       q: 8192,
//       df: Math.floor(701/3),
//       dg: Math.floor(701/3),
//       dr: Math.floor(701/3),
//       N: 509,
//       q: 2048,
//       df: Math.floor(509/3),
//       dg: Math.floor(509/3),
//       dr: Math.floor(509/3),
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

function bigintToBits(bigint) {
  const bits = [];
  // While the number is not zero, extract the least significant bit (LSB) and shift right
  while (bigint > 0n) {
      bits.push(Number(bigint & 1n)); // Get the LSB (0 or 1)
      bigint >>= 1n; // Shift right by 1 bit
  }
  return bits;
}

function bitsToBigInt(bits) {
  return BigInt(`0b${bits.join('')}`);
}

function packOutput(maxVal, dataLen, data) {
  const maxInputBits = Math.log2(maxVal);
  const numInputsPerOutput = Math.floor(252/maxInputBits);
  const arrLen = Math.max(
    Math.ceil(dataLen / numInputsPerOutput) * numInputsPerOutput,
    numInputsPerOutput * 3, // need min of 3 output field elements
  );
  const maxOutputBits = numInputsPerOutput * maxInputBits;
  const outputSize = Math.max(Math.ceil(arrLen / numInputsPerOutput), 3); // need min of 3 for burn details
  const inArr = expandArray(data, arrLen, 0);
  const expected = inArr.reduce((out, cur, i) => {
    const outIdx = Math.floor(i/numInputsPerOutput);
    out[outIdx] += BigInt(cur) * BigInt(2 ** ((i % numInputsPerOutput) * maxInputBits));
    return out;
  }, new Array(outputSize).fill(0n));
  const inputSize = (outputSize * numInputsPerOutput) / maxInputBits;
  return {
    maxInputBits,
    maxOutputBits,
    outputSize,
    arrLen,
    expected,
  }
}

function unpackInput(maxVal, packedBits, data) {
  const maxInputBits = Math.log2(maxVal);
  const numInputsPerOutput = packedBits/maxInputBits;
  const unpackedSize = numInputsPerOutput * data.length;
  const mask = (1n << BigInt(maxInputBits)) - 1n;
  const unpacked = trimPolynomial(data.reduce((out, cur, i) => {
    for(let j = 0; j < numInputsPerOutput; j++) {
      const shift = BigInt(j * maxInputBits);
      const chunk = (cur >> shift) & mask;
      out[i * numInputsPerOutput + j] = Number(chunk);
    }
    return out;
  }, new Array(unpackedSize).fill(0)));

  return {
    maxInputBits,
    packedBits,
    packedSize: data.length,
    unpackedSize,
    unpacked,
  };
}

function calcMultiHash(input) {
  let hash = poseidon2([input[0], input[1]]);
  for(let i = 2; i<input.length; i++) {
    hash = poseidon2([hash, input[i]]);
  }
  return hash;
}

describe("privacy-token", () => {
  it("verifies a send/receive (both)", async () => {
    const receiveAmount = 223n;
    const receiveEncrypted = ntru.encryptBits(bigintToBits(receiveAmount));
    const receivePacked = packOutput(ntru.q, ntru.N+1, receiveEncrypted.inputs.remainderE);
    const receiveDecrypted = ntru.decryptBits(receiveEncrypted.value);
    const receiveTxHash = calcMultiHash(receivePacked.expected);

    // privkey for balance symmetric encryption is packed+summed f
    const privKeyPacked = packOutput(4, ntru.N, receiveDecrypted.inputs.f.map(x=>x===ntru.q-1 ? 2 : x));
    const privateKey = privKeyPacked.expected.reduce((sum, cur) => sum + cur, 0n) % SNARK_FIELD_SIZE;
    const receiveNullifier = poseidon2([receiveTxHash, privateKey]);
    // pubkey for encrypted balance storage is hash of the packed f
    const publicKey = calcMultiHash(privKeyPacked.expected);

    const balance = 987n;
    const balanceNonce = 1234n;
    const newBalanceNonce = 1235n;
    const encryptedBalance = await symmetricEncrypt(balance, privateKey, balanceNonce);
    const sendAmount = balance + receiveAmount - 1n;
    const finalBalance = await symmetricEncrypt(balance + receiveAmount - sendAmount, privateKey, newBalanceNonce);

    const sendEncrypted = ntru.encryptBits(bigintToBits(sendAmount));
    const sendPacked = packOutput(ntru.q, ntru.N+1, sendEncrypted.inputs.remainderE);
    const sendUnpacked = unpackInput(ntru.q, sendPacked.maxOutputBits, sendPacked.expected);

    const verifyKeys = ntru.verifyKeysInputs();

    const { treeSiblings, treeIndices, treeDepth, treeRoot } = genTree([
      poseidon2([ 123n, 456n ]), // first item doesn't matter
      receiveTxHash, // genTree uses this second item
    ]);

    const circuit = await circomkit.WitnessTester(`privacytoken`, {
      file: "privacy-token",
      template: "PrivacyToken",
      dir: "test/privacy-token",
      params: [
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
      ],
    });
    const input = {
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
      sendAmount,
      recipH: sendEncrypted.inputs.h,
      sendR: sendEncrypted.inputs.r,
      sendQuotient: sendEncrypted.inputs.quotientE,
      sendRemainder: sendEncrypted.inputs.remainderE,
      burnAddress: 0,
      isBurn: 0,
      isReceiving: 1,
      // This value will not be output in this test case because it is receiving
      nonReceivingTreeRoot: 0n,
    };
    await circuit.expectPass(input, {
      publicKey,
      treeRoot,
      encryptedAmountSent: sendPacked.expected,
      finalBalance,
      receiveNullifier,
    });
  });

  it("verifies a mint", async () => {
    const sendAmount = MAX_SEND_AMOUNT - 3n;
    const encrypted = ntru.encryptBits(bigintToBits(sendAmount));
    const sendPacked = packOutput(ntru.q, ntru.N+1, encrypted.inputs.remainderE);

    const circuit = await circomkit.WitnessTester(`privatemint`, {
      file: "privacy-token",
      template: "PrivateMint",
      dir: "test/privacy-token",
      params: [
        MAX_AMOUNT_BITS,
        MAX_SEND_AMOUNT,
        ntru.q,
        ntru.calculateNq(),
        ntru.N,
        sendPacked.maxInputBits,
        sendPacked.maxOutputBits,
        sendPacked.outputSize,
        sendPacked.arrLen,
      ],
    });
    const inputs = {
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

    const { treeSiblings, treeIndices, treeDepth, treeRoot } = genTree([
      poseidon2([ encAmount1, ephemKey1 ]),
      poseidon2([ encAmount2, ephemKey2 ]),
    ]);

    const circuit = await privacyToken();
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
      isBurn: 0,
      isReceiving: 0,
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

    const { treeSiblings, treeIndices, treeDepth, treeRoot } = genTree([
      poseidon2([ encAmount1, ephemKey1 ]),
      poseidon2([ encAmount2, ephemKey2 ]),
    ]);

    const circuit = await privacyToken();
    await circuit.expectFail({
      encryptedAmountReceived: encAmount2,
      ephemeralKeyReceived: ephemKey2,
      decodedAmountReceived: sendAmount2,
      treeDepth,
      treeIndices,
      treeSiblings,
      privateKey,
      encryptedBalance,
      balanceNonce,
      newBalanceNonce,
      sendAmount,
      sendNonce,
      recipPubKey,
      isBurn: 0,
      isReceiving: 1,
      // This value will not be output in this test case because it is receiving
      nonReceivingTreeRoot: 0n,
    });
  });

  it("fails when send amount is over max send", async () => {
    const MAX_DEPTH = 10;
    const MAX_AMOUNT_BITS = 19;
    const privateKey = 0x10644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;
    const publicKey = F.pow(BASE, privateKey);
    const encAmount1 = 123n;
    const ephemKey1 = 234n;
    const sendAmount2Nonce = 456n;
    const sendAmount2 = 223n;
    const {encryptedMessage: encAmount2, ephemeralKey: ephemKey2} = await asymmetricEncrypt(sendAmount2, publicKey, sendAmount2Nonce);
    const balance = MAX_SEND_AMOUNT + 100n;
    const balanceNonce = 1234n;
    const newBalanceNonce = 1235n;
    const encryptedBalance = await symmetricEncrypt(balance, privateKey, balanceNonce);
    const sendAmount = MAX_SEND_AMOUNT + 1n;
    const sendNonce = 2345n;
    const recipPrivateKey = 0x20644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;
    const recipPubKey = F.pow(BASE, recipPrivateKey);
    const {encryptedMessage: encryptedAmountSent, ephemeralKey: sendEphemeralKey} = await asymmetricEncrypt(sendAmount, recipPubKey, sendNonce);
    const receiveTxHash = poseidon2([encAmount2, ephemKey2]);
    const receiveNullifier = poseidon2([receiveTxHash, privateKey]);
    const finalBalance = await symmetricEncrypt(balance + sendAmount2 - sendAmount, privateKey, newBalanceNonce);

    const { treeSiblings, treeIndices, treeDepth, treeRoot } = genTree([
      poseidon2([ encAmount1, ephemKey1 ]),
      poseidon2([ encAmount2, ephemKey2 ]),
    ]);

    const circuit = await privacyToken();
    await circuit.expectFail({
      encryptedAmountReceived: encAmount2,
      ephemeralKeyReceived: ephemKey2,
      decodedAmountReceived: sendAmount2,
      treeDepth,
      treeIndices,
      treeSiblings,
      privateKey,
      encryptedBalance,
      balanceNonce,
      newBalanceNonce,
      sendAmount,
      sendNonce,
      recipPubKey,
      isBurn: 0,
      isReceiving: 1,
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

    const { treeSiblings, treeIndices, treeDepth, treeRoot } = genTree([
      poseidon2([ encAmount1, ephemKey1 ]),
      poseidon2([ encAmount2, ephemKey2 ]),
    ]);

    const circuit = await privacyToken();
    await circuit.expectPass({
      encryptedAmountReceived: encAmount2,
      ephemeralKeyReceived: ephemKey2,
      decodedAmountReceived: sendAmount2,
      treeDepth,
      treeIndices,
      treeSiblings,
      privateKey,
      encryptedBalance,
      balanceNonce,
      newBalanceNonce,
      sendAmount,
      sendNonce,
      recipPubKey,
      isBurn: 0,
      isReceiving: 0,
      // This value will be output in this test case because it is NOT receiving
      nonReceivingTreeRoot,
    }, {
      treeRoot: nonReceivingTreeRoot,
      encryptedAmountSent,
      sendEphemeralKey,
      finalBalance,
      receiveNullifier,
    });
  });

  it("verifies a burn", async () => {
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
    const sendAmount = balance;
    const sendNonce = 2345n;
    // burn by sending to ethereum address instead of pubkey
    const recipPubKey = 0xa48c718AE6dE6599c5A46Fd6caBff54Def39473an;
    const receiveTxHash = poseidon2([encAmount2, ephemKey2]);
    const receiveNullifier = poseidon2([receiveTxHash, privateKey]);
    const nonReceivingTreeRoot = 169n;
    const finalBalance = await symmetricEncrypt(balance - sendAmount, privateKey, newBalanceNonce);

    const { treeSiblings, treeIndices, treeDepth, treeRoot } = genTree([
      poseidon2([ encAmount1, ephemKey1 ]),
      poseidon2([ encAmount2, ephemKey2 ]),
    ]);

    const circuit = await privacyToken();
    const input = {
      encryptedAmountReceived: encAmount2,
      ephemeralKeyReceived: ephemKey2,
      decodedAmountReceived: sendAmount2,
      treeDepth,
      treeIndices,
      treeSiblings,
      privateKey,
      encryptedBalance,
      balanceNonce,
      newBalanceNonce,
      sendAmount,
      sendNonce,
      recipPubKey,
      isBurn: 1,
      isReceiving: 0,
      // This value will be output in this test case because it is NOT receiving
      nonReceivingTreeRoot,
    };
    const output = {
      publicKey,
      treeRoot: nonReceivingTreeRoot,
      // burns don't encrypt the amount sent
      encryptedAmountSent: sendAmount,
      sendEphemeralKey: recipPubKey,
      finalBalance,
      receiveNullifier,
    };
//     console.log(JSON.stringify(input, null, 2));
//     console.log(JSON.stringify(output, null, 2));
    await circuit.expectPass(input, output);
  });
});

async function privacyToken() {
  const circuit = await circomkit.WitnessTester(`privacytoken`, {
    file: "privacy-token",
    template: "PrivacyToken",
    dir: "test/privacy-token",
    params: [MAX_DEPTH, MAX_AMOUNT_BITS, MAX_SEND_AMOUNT],
  });
  return circuit;
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
