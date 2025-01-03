import { LeanIMT } from "@zk-kit/imt";
import { getContract } from 'viem';
import { groth16 } from 'snarkjs';
import { poseidon2 } from 'poseidon-lite';
import NTRU, {
  bigintToBits,
  bitsToBigInt,
  packOutput,
  unpackInput,
} from 'ntru-circom';

import {
  genTree,
  getCalldata,
  genRandomBabyJubValue,
  SNARK_FIELD_SIZE,
  symmetricEncrypt,
  symmetricDecrypt,
} from './utils.js';
import abi from './abi/PrivateToken.json';
import registryAbi from './abi/KeyRegistry.json';
import {byChain} from'./contracts.js';

export const SESH_KEY = 'private-token-session';

export default class PrivateTokenSession {
  constructor(options) {
    Object.assign(this, {
      ntru: {
        // very small keys, not secure, but fast
        N: 17,
        q: 32,
        df: 3,
        dg: 2,
        dr: 2,
      },
      incoming: {},
    }, options);

    this.ntru = new NTRU(this.ntru);
    if(this.ntru.f) {
      this.ntru.loadPrivateKeyF(this.ntru.f);
      this.ntru.verifyKeysInputs();
    } else {
      this.ntru.generatePrivateKeyF();
      this.ntru.generateNewPublicKeyGH();
    }
  }
  async export() {
    const {password} = this;
    if(!password) throw new Error('Missing password!');

    const data = JSON.parse(JSON.stringify(this));
    delete data.ntru.fp;
    delete data.ntru.fq;
    delete data.ntru.I;
    return encryptJson(JSON.stringify(data), password);
  }
  async saveToLocalStorage() {
    const data = await this.export();
    localStorage.setItem(SESH_KEY, JSON.stringify(data));
  }
  async download() {
    const data = await this.export();
    downloadTextFile(JSON.stringify(data), 'private-wallet.sesh');
  }
  static hasLocalStorage() {
    return localStorage.hasOwnProperty(SESH_KEY);
  }
  static async loadFromLocalStorage(password) {
    return new PrivateTokenSession(JSON.parse(await decryptJson(JSON.parse(localStorage.getItem(SESH_KEY)), password)));
  }
  static async import(data, password) {
    return new PrivateTokenSession(JSON.parse(await decryptJson(data, password)));
  }
  // TODO this in the wrong spot
  static fromPackedPublicKey(hBytes) {
    // First need to calculate the maxOutputBits for a public key packing
    const {ntru} = new PrivateTokenSession;
    const hPacked = packOutput(ntru.q, ntru.N, ntru.h);
    const unpacked = splitHexToBigInt(hBytes, hPacked.maxOutputBits);
    const toRaw = unpackInput(ntru.q, hPacked.maxOutputBits, unpacked);
    ntru.h = toRaw.unpacked;
    return ntru;
  }
  async scanForIncoming(client, tokenAddr, chainId) {
    const contract = getContract({
      client,
      abi,
      address: byChain[chainId].PrivateToken,
    });
    const count = Number(await contract.read.sendCount([tokenAddr]));
    if(!(chainId in this.incoming)) this.incoming[chainId] = {};
    const oldCount = tokenAddr in this.incoming[chainId] ? this.incoming[chainId][tokenAddr].count : 0;
    return { count, oldCount };
  }
  decryptIncoming(encValue) {
    // First need to calculate the maxOutputBits for a public key packing
    const {ntru} = new PrivateTokenSession;

    const hPacked = packOutput(ntru.q, ntru.N, ntru.h);
    const unpacked = splitHexToBigInt(encValue, 256);
    // For small (test size) keys, the value is shorter than one element
    const toRaw = unpackInput(ntru.q, Math.min(ntru.N * hPacked.maxInputBits, hPacked.maxOutputBits), unpacked);
    const decrypted = this.ntru.decryptBits(toRaw.unpacked);
    const receiveTxHash = calcMultiHash(unpacked);

    // TODO also add padding for more checking
    // Invalid decryption
    const failed = decrypted.value.some(x=>!(x===0 || x===1));

    return {
      value: failed ? null : bitsToBigInt(decrypted.value.slice().reverse()),
      encBits: toRaw.unpacked,
      receiveTxHash,
      unpacked,
    };
  }
  async receiveTx(tokenAddr, chainId, encBits, index, unpacked, client, userAddress, receiveAmount) {
    const {ntru} = this;
    const receiveDecrypted = ntru.decryptBits(encBits);
    const verifyKeys = ntru.verifyKeysInputs();

    const leaves = this.incoming[chainId][tokenAddr].found.map(item => BigInt(item.receiveTxHash));
    const { treeSiblings, treeIndices, treeDepth, treeRoot } = genTree(leaves, index);

    const contract = getContract({
      client,
      abi,
      address: byChain[chainId].PrivateToken,
    });
    const account = await contract.read.accounts([tokenAddr, userAddress]);

    const sendAmount = 0n;
    // TODO send this zero amount to a zero (burn) pubkeyH
    const sendEncrypted = ntru.encryptBits(bigintToBits(sendAmount));

    const newBalanceNonce = genRandomBabyJubValue();
    const {privateKey, publicKey} = this.balanceKeypair();
    const test1 = symmetricEncrypt(12345n, privateKey, newBalanceNonce);
    const test2 = symmetricDecrypt(test1, privateKey, newBalanceNonce);
    const balance = account[0] === 0n ? 0n : symmetricDecrypt(account[0], privateKey, account[1]);
    const finalBalance = symmetricEncrypt(
      balance + BigInt(receiveAmount) - sendAmount,
      privateKey,
      newBalanceNonce
    );

    const inputs = {
      tokenAddr,
      chainId,
      encryptedReceive: unpacked,
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
      encryptedBalance: account[0],
      balanceNonce: account[1],
      newBalanceNonce,
      sendAmount,
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

    const proof = await groth16.fullProve(
      inputs,
      'circuits/main/verify_circuit.wasm',
      'circuits/main/groth16_pkey.zkey',
    );

    if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate();

    const args = getCalldata(proof);
    return {
      abi,
      address: byChain[chainId].PrivateToken,
      functionName: 'verifyProof',
      args,
    };
  }
  async setLastScanned(tokenAddr, chainId, count, newItems) {
    if(!(chainId in this.incoming)) this.incoming[chainId] = {};
    if(!(tokenAddr in this.incoming[chainId])) {
      this.incoming[chainId][tokenAddr] = { count, found: newItems };
    } else {
      this.incoming[chainId][tokenAddr].count = count;
      newitems.forEach(item => this.incoming[chainId][tokenAddr].found.push(item));
    }
    await this.saveToLocalStorage();
  }
  balanceKeypair() {
    const {ntru} = this;
    // privkey for balance symmetric encryption is packed+summed f
    const privKeyPacked = packOutput(4, ntru.N, ntru.f.map(x=>x===-1 ? 2 : x));
    const privateKey = privKeyPacked.expected.reduce((sum, cur) => sum + cur, 0n) % SNARK_FIELD_SIZE;
    // pubkey for encrypted balance storage is hash of the packed f
    const publicKey = calcMultiHash(privKeyPacked.expected);

    return {publicKey, privateKey};
  }
  balanceViewTx(tokenAddr, chainId) {
    return {
      abi,
      chainId,
      address: byChain[chainId].PrivateToken,
      functionName: 'accounts',
      args: [tokenAddr, this.balanceKeypair().publicKey],
    };
  }
  registerTx(chainId) {
    const {ntru} = this;
    const hPacked = packOutput(ntru.q, ntru.N, ntru.h);
    const hBytes = combineBigIntToHex(hPacked.expected, hPacked.maxOutputBits);

    return {
      abi: registryAbi,
      address: byChain[chainId].KeyRegistry,
      functionName: 'set',
      args: [ `0x${hBytes}` ],
    };

  }
  async mintTx(sendAmount, tokenAddr, chainId) {
    const {ntru} = this;
    const encrypted = ntru.encryptBits(bigintToBits(sendAmount));
    const sendPacked = packOutput(ntru.q, ntru.N+1, encrypted.inputs.remainderE);
    const decrypted = ntru.decryptBits(encrypted.value);

    const inputs = {
      tokenAddr,
      chainId,
      sendAmount,
      recipH: encrypted.inputs.h,
      sendR: encrypted.inputs.r,
      quotientE: encrypted.inputs.quotientE,
      remainderE: encrypted.inputs.remainderE,
    };

    const proof = await groth16.fullProve(
      inputs,
      'circuits/mint/verify_circuit.wasm',
      'circuits/mint/groth16_pkey.zkey',
    );

    if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate();

    const args = getCalldata(proof);
    return {
      abi,
      address: byChain[chainId].PrivateToken,
      functionName: 'mint',
      args,
    };
  }
  mainTx() {
  }
}

function downloadTextFile(content, filename) {
  const blob = new Blob([content], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function calcMultiHash(input) {
  let hash = poseidon2([input[0], input[1]]);
  for(let i = 2; i<input.length; i++) {
    hash = poseidon2([hash, input[i]]);
  }
  return hash;
}

function combineBigIntToHex(bigints, maxBits) {
    if (!Array.isArray(bigints) || !bigints.every(b => typeof b === 'bigint')) {
        throw new TypeError('Input must be an array of BigInt values.');
    }

    if (typeof maxBits !== 'number' || maxBits <= 0 || !Number.isInteger(maxBits)) {
        throw new TypeError('maxBits must be a positive integer.');
    }

    const maxValue = (1n << BigInt(maxBits)) - 1n; // Maximum value that fits within maxBits

    // Ensure all BigInt values are within the allowable range
    for (const bigint of bigints) {
        if (bigint < 0n || bigint > maxValue) {
            throw new RangeError(`BigInt value ${bigint} exceeds the allowable range for ${maxBits} bits.`);
        }
    }

    let combinedBinary = '';

    // Convert each BigInt to binary and pad it to the required length
    for (const bigint of bigints) {
        const binaryString = bigint.toString(2).padStart(maxBits, '0');
        combinedBinary += binaryString;
    }

    // Convert the combined binary string to a hexadecimal string
    let combinedHex = BigInt('0b' + combinedBinary).toString(16);
    if (combinedHex.length % 2 !== 0) {
      combinedHex = combinedHex + '0';
    }

    return combinedHex;
}


function splitHexToBigInt(hexString, maxBits) {
    if (typeof hexString !== 'string') {
        throw new TypeError('Input must be a hexadecimal string.');
    }

    if (typeof maxBits !== 'number' || maxBits <= 0 || !Number.isInteger(maxBits)) {
        throw new TypeError('maxBits must be a positive integer.');
    }

    let combinedBinary = BigInt(hexString).toString(2);
    const totalBits = combinedBinary.length;

    // Pad combinedBinary with leading zeros if it doesn't align with maxBits
    const paddedLength = Math.ceil(totalBits / maxBits) * maxBits;
    combinedBinary = combinedBinary.padStart(paddedLength, '0');

    const bigints = [];
    for (let i = 0; i < combinedBinary.length; i += maxBits) {
        const segment = combinedBinary.slice(i, i + maxBits);
        bigints.push(BigInt('0b' + segment));
    }

    return bigints;
}


// Helper function to encode ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

// Helper function to decode Base64 to ArrayBuffer
function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Encrypt JSON text string with a password
async function encryptJson(jsonString, password) {
  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherText = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    derivedKey,
    enc.encode(jsonString)
  );

  return {
    cipherText: arrayBufferToBase64(cipherText),
    iv: arrayBufferToBase64(iv),
    salt: arrayBufferToBase64(salt),
  };
}

// Decrypt encrypted JSON text string with a password
async function decryptJson(encryptedData, password) {
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const passwordKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const salt = base64ToArrayBuffer(encryptedData.salt);
  const iv = base64ToArrayBuffer(encryptedData.iv);
  const cipherText = base64ToArrayBuffer(encryptedData.cipherText);

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    derivedKey,
    cipherText
  );

  return dec.decode(decrypted);
}

