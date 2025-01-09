import { LeanIMT } from "@zk-kit/imt";
import { poseidon2 } from "poseidon-lite";

export const SNARK_FIELD_SIZE = 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;
const MAX_DEPTH = 32;

export function genTree(items, proofIndex) {
  const tree = new LeanIMT((a, b) => poseidon2([a, b]));

  items.forEach(item => tree.insert(item));

  const { siblings: treeSiblings, index } = tree.generateProof(proofIndex);

  // The index must be converted to a list of indices, 1 for each tree level.
  // The circuit tree depth is 20, so the number of siblings must be 20, even if
  // the tree depth is actually 3. The missing siblings can be set to 0, as they
  // won't be used to calculate the root in the circuit.
  const treeIndices = [];
  let treeDepth;

  for (let i = 0; i < MAX_DEPTH; i += 1) {
      treeIndices.push((index >> i) & 1);

      if (treeSiblings[i] === undefined) {
          if(treeDepth === undefined) {
            treeDepth = i;
          }
          treeSiblings[i] = BigInt(0);
      }
  }

  return {
    treeSiblings,
    treeIndices,
    treeDepth,
    treeRoot: tree.root
  };
}

export function getCalldata(proof) {
  const calldata = JSON.parse('[' +
    groth16Calldata(proof.proof)
    + ',' +
    publicSignalsCalldata(proof.publicSignals)
    + ']');
  return calldata;

}

export function downloadTextFile(content, filename) {
  const blob = new Blob([content], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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

// From https://github.com/Shigoto-dev19/ec-elgamal-circom
/**
 * Returns a BabyJub-compatible random value. We create it by first generating
 * a random value (initially 256 bits large) modulo the snark field size as
 * described in EIP197. This results in a key size of roughly 253 bits and no
 * more than 254 bits. To prevent modulo bias, we then use this efficient
 * algorithm:
 * http://cvsweb.openbsd.org/cgi-bin/cvsweb/~checkout~/src/lib/libc/crypt/arc4random_uniform.c
 * @return A BabyJub-compatible random value.
 * @see {@link https://github.com/privacy-scaling-explorations/maci/blob/master/crypto/ts/index.ts}
 */
export function genRandomBabyJubValue() {
    // Prevent modulo bias
    //const lim = BigInt('0x10000000000000000000000000000000000000000000000000000000000000000')
    //const min = (lim - SNARK_FIELD_SIZE) % SNARK_FIELD_SIZE
    const min = BigInt(
        "6350874878119819312338956282401532410528162663560392320966563075034087161851",
    );

    let rand;
    while (true) {
        const buffer = new Uint8Array(32);
        crypto.getRandomValues(buffer);

        // Convert the buffer to a hexadecimal string and then to a BigInt
        rand = BigInt("0x" + Array.from(buffer, byte => byte.toString(16).padStart(2, '0')).join(''));

        if (rand >= min) {
            break;
        }
    }

    const privKey = rand % SNARK_FIELD_SIZE;

    return privKey;
}

export function symmetricEncrypt(message, key, nonce) {
  return poseidon2([key, nonce]) + message;
}

export function symmetricDecrypt(message, key, nonce) {
  return (message - poseidon2([key, nonce])) % SNARK_FIELD_SIZE;
}
