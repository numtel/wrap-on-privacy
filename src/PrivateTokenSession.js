import { groth16 } from 'snarkjs';
import { poseidon2 } from "poseidon-lite";
import NTRU, {
  bigintToBits,
  packOutput,
} from 'ntru-circom';

import {
  poseidonDecrypt,
  genTree,
  getCalldata,
  pubKey,
  randomBigInt,
} from './utils.js';
import abi from './abi/PrivateToken.json';
import registryAbi from './abi/KeyRegistry.json';

const contractAddr = '0xB9DE28d814C68028178b4dB26cA47D2458535351';
const registryAddr = '0x1BbF48d8178743605C0BE1e5708Bf7e0a38B22E0';

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
  export() {
    const {password} = this;
    if(!password) throw new Error('missing password');

    const data = JSON.parse(JSON.stringify(this));
    delete data.ntru.fp;
    delete data.ntru.fq;
    delete data.ntru.I;
    return encryptJson(JSON.stringify(data), password);
  }
  static async import(data, password) {
    return new PrivateTokenSession(JSON.parse(await decryptJson(data, password)));
  }
  scanForIncoming() {
  }
  balanceKeypair() {
    const {ntru} = this;
    // privkey for balance symmetric encryption is packed+summed f
    const privKeyPacked = packOutput(4, ntru.N, receiveDecrypted.inputs.f.map(x=>x===ntru.q-1 ? 2 : x));
    const privateKey = privKeyPacked.expected.reduce((sum, cur) => sum + cur, 0n) % SNARK_FIELD_SIZE;
    const receiveNullifier = poseidon2([receiveTxHash, privateKey]);
    // pubkey for encrypted balance storage is hash of the packed f
    const publicKey = calcMultiHash(privKeyPacked.expected);

    return {publicKey, privateKey};
  }
  async mintTx(sendAmount, tokenAddr, chainId) {
    const {ntru} = this;
    const encrypted = ntru.encryptBits(bigintToBits(sendAmount));
    const sendPacked = packOutput(ntru.q, ntru.N+1, encrypted.inputs.remainderE);

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
      address: contractAddr,
      functionName: 'mint',
      args,
    };
  }
  mainTx() {
  }
}

function calcMultiHash(input) {
  let hash = poseidon2([input[0], input[1]]);
  for(let i = 2; i<input.length; i++) {
    hash = poseidon2([hash, input[i]]);
  }
  return hash;
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

