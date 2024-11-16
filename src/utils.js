import {Scalar, ZqField} from "ffjavascript";
import { LeanIMT } from "@zk-kit/imt";
import { poseidon2 } from "poseidon-lite";

const SNARK_FIELD_SIZE = 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;
const F = new ZqField(Scalar.fromString(SNARK_FIELD_SIZE.toString()));
const BASE = F.e(2);
const MAX_DEPTH = 32;

let lookupTable;

export function elgamalDecrypt(privateKey, ephemeralKey, encryptedMessage) {
  const maskingKey = F.pow(ephemeralKey, privateKey);
  const decryptedMessage = F.div(encryptedMessage, maskingKey);
  return decryptedMessage;
}

export function elgamalDecode(decryptedMessage) {
  if(!lookupTable) {
    const list = [];
    for(let i = 0; i <= 2**19; i++) {
      list.push(F.pow(BASE, i));
    }
    lookupTable = list;
  }
  for(let i = 0; i < lookupTable.length; i++) {
    if(decryptedMessage === lookupTable[i]) return i;
  }
  return null;
}

export function poseidonDecrypt(privateKey, nonce, ciphertext) {
  const hash = poseidon2([ privateKey, nonce ]);
  return F.sub(ciphertext, hash);
}

export function pubKey(priv) {
  return F.pow(BASE, priv);
}

export function sigToKeyPair(signature) {
  const priv = F.e(signature);
  return { priv, pub: pubKey(priv) };
}

export function randomBigInt(bits) {
    const bytes = Math.ceil(bits / 8);
    const randomBytes = new Uint8Array(bytes);
    crypto.getRandomValues(randomBytes);

    let bigint = BigInt(0);
    for (let byte of randomBytes) {
        bigint = (bigint << BigInt(8)) | BigInt(byte);
    }

    return bigint;
}

export function genTree(items, proofIndex) {
  console.log(items, proofIndex);
  const tree = new LeanIMT((a, b) => poseidon2([a, b]));

  items.forEach(item => tree.insert(item));

  const { siblings: treeSiblings, index } = tree.generateProof(proofIndex);

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

export function getCalldata(proof) {
  const calldata = JSON.parse('[' +
    groth16Calldata(proof.proof)
    + ',' +
    publicSignalsCalldata(proof.publicSignals)
    + ']');
  return calldata;

}


// The following is adapted from circomkit/src/utils/calldata.ts
/** Makes each value 32-bytes long hexadecimal. Does not check for overflows! */
function valuesToPaddedUint256s(vals) {
  return vals.map(val => '0x' + BigInt(val).toString(16).padStart(64, '0'));
}

/** Wraps a string with double quotes. */
function withQuotes(vals) {
  return vals.map(val => `"${val}"`);
}

function publicSignalsCalldata(pubs) {
  const pubs256 = valuesToPaddedUint256s(pubs);
  return `[${pubs256.map(s => `"${s}"`).join(',')}]`;
}

function groth16Calldata(proof) {
  const pA = valuesToPaddedUint256s([proof.pi_a[0], proof.pi_a[1]]);
  const pC = valuesToPaddedUint256s([proof.pi_c[0], proof.pi_c[1]]);

  // note that pB are reversed, notice the indexing is [1] and [0] instead of [0] and [1].
  const pB0 = valuesToPaddedUint256s([proof.pi_b[0][1], proof.pi_b[0][0]]);
  const pB1 = valuesToPaddedUint256s([proof.pi_b[1][1], proof.pi_b[1][0]]);

  return [
    `[${withQuotes(pA).join(', ')}]`,
    `[[${withQuotes(pB0).join(', ')}], [${withQuotes(pB1).join(', ')}]]`,
    `[${withQuotes(pC).join(', ')}]`,
  ].join(',');
}
