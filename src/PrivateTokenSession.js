import { LeanIMT } from "@zk-kit/imt";
import { getContract } from 'viem';
import { groth16 } from 'snarkjs';
import { poseidon5, poseidon2, poseidon1 } from 'poseidon-lite';
import NTRU, {
  bigintToBits,
  bitsToBigInt,
  packOutput,
  unpackInput,
  expandArray,
  trimPolynomial,
} from 'ntru-circom';

import {
  genTree,
  getCalldata,
  genRandomBabyJubValue,
  SNARK_FIELD_SIZE,
  symmetricEncrypt,
  symmetricDecrypt,
  downloadTextFile,
  randomBigInt,
} from './utils.js';
import abi from './abi/PrivateToken.json';
import registryAbi from './abi/KeyRegistry.json';
import {byChain} from'./contracts.js';

export const SESH_KEY = 'private-token-session';

export default class PrivateTokenSession {
  constructor(options) {
    Object.assign(this, {
      ntru: {
        // Need at least 664 bits for 252 (blinding) + 252 (amount) + 160 (token)
        // Therefore, use NTRU 192-bit security margin parameters
        N: 677,
        q: 2048,
        df: Math.floor(677/3),
        dg: Math.floor(677/3),
        dr: Math.floor(677/3),
      },
      privateKey: genRandomBabyJubValue().toString(),
      incoming: {},
    }, options);

    this.ntru = new NTRU(this.ntru);
    if(this.ntru.f) {
      if(!this.ntru.fq || !this.ntru.fp) {
        console.time('load');
        this.ntru.loadPrivateKeyF(this.ntru.f);
        console.timeEnd('load');
      }
      console.time('load2');
      this.ntru.verifyKeysInputs();
      console.timeEnd('load2');
    } else if(!this.ntru.h) {
      console.time('gen');
      // TODO only do this if it's requested to be done
      // TODO need to do this in a web worker!
      this.ntru.generatePrivateKeyF();
      console.timeEnd('gen');
      console.time('gen2');
      this.ntru.generateNewPublicKeyGH();
      console.timeEnd('gen2');
    }
  }
  async export() {
    const {password} = this;
    if(!password) throw new Error('Missing password!');

    const data = JSON.parse(JSON.stringify(this));
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
    return PrivateTokenSession.import(JSON.parse(localStorage.getItem(SESH_KEY)), password);
  }
  static async import(data, password) {
    return new PrivateTokenSession(JSON.parse(await decryptJson(data, password)));
  }
  fromPackedPublicKey(hBytes) {
    // First need to calculate the maxOutputBits for a public key packing
    const {ntru} = this;
    const hPacked = packOutput(ntru.q, ntru.N, ntru.h);
    const unpacked = splitHexToBigInt(hBytes, hPacked.maxOutputBits);
    // For small (test size) keys, the value is shorter than one element
    const toRaw = unpackInput(ntru.q, Math.min(ntru.N * hPacked.maxInputBits, hPacked.maxOutputBits), unpacked);
    const newSesh = new PrivateTokenSession({
      ntru: {
        N: ntru.N,
        q: ntru.q,
        h: toRaw.unpacked,
      },
    });
    return newSesh;
  }
  async scanForIncoming(client, treeIndex, chainId) {
    const contract = getContract({
      client,
      abi,
      address: byChain[chainId].PrivateToken,
    });
    const count = Number(await contract.read.sendCount([treeIndex]));
    if(!(chainId in this.incoming)) this.incoming[chainId] = {};
    const oldCount = treeIndex in this.incoming[chainId] ? this.incoming[chainId][treeIndex].count : 0;
    console.log(count, oldCount);
    return { count, oldCount };
  }
  decryptIncoming(encValue, chainId) {
    // First need to calculate the maxOutputBits for a public key packing
    const {ntru} = this;

    const noteDataRev = splitHexToBigInt(encValue, Math.log2(ntru.q)+1).map(x=>Number(x));
    const decrypted = ntru.decryptBits(trimPolynomial(noteDataRev));

    // Invalid decryption
    const failed = decrypted.value.some(x=>!(x===0 || x===1));
    if(failed) return null;

    const tokenAddr = bitsToBigInt(decrypted.value.slice(0, 160).reverse());
    const sendAmount = bitsToBigInt(decrypted.value.slice(160, 160+256).reverse());
    const sendBlinding = bitsToBigInt(decrypted.value.slice(160+256, 160 + 256*2).reverse());

    let {publicKey} = this.balanceKeypair();
    const hash = poseidon5([ tokenAddr, chainId, sendAmount, sendBlinding, publicKey ]);

    return {tokenAddr, sendAmount, sendBlinding, hash};
  }
  async receiveTx(chainId, treeIndex, item, client) {
    return await this.sendPrivateTx(
      BigInt(item.sendAmount),
      BigInt(item.tokenAddr),
      chainId,
      client,
      null, // recipAddr,
      0, // publicMode,
      BigInt(item.sendBlinding),
      treeIndex
    );
  }
  async setLastScanned(treeIndex, chainId, count, newItems) {
    if(!(chainId in this.incoming)) this.incoming[chainId] = {};
    if(!(treeIndex in this.incoming[chainId])) {
      this.incoming[chainId][treeIndex] = { count, found: newItems };
    } else {
      this.incoming[chainId][treeIndex].count = count;
      newItems.forEach(item => this.incoming[chainId][treeIndex].found.push(item));
    }
    await this.saveToLocalStorage();
  }
  balanceKeypair() {
    const {privateKey} = this;
    const publicKey = poseidon1([privateKey]);
    return {publicKey, privateKey};
  }
  balanceViewTx(tokenAddr, chainId) {
    if(!tokenAddr) return {};
    const {publicKey, privateKey} = this.balanceKeypair();
    return {
      abi,
      chainId,
      address: byChain[chainId].PrivateToken,
      functionName: 'accounts',
      args: [poseidon2([privateKey, tokenAddr]), publicKey],
    };
  }
  registerTx(chainId) {
    const {ntru} = this;
    const hPacked = packOutput(ntru.q, ntru.N, ntru.h);
    const hBytes = combineBigIntToHex(hPacked.expected, hPacked.maxOutputBits);
    const {publicKey, privateKey} = this.balanceKeypair();
    const balancePubBytes = combineBigIntToHex([publicKey], 256);

    return {
      abi: registryAbi,
      address: byChain[chainId].KeyRegistry,
      functionName: 'set',
      args: [ `0x${hBytes}${balancePubBytes}` ],
    };

  }
  async sendPrivateTx(sendAmount, tokenAddr, chainId, client, recipAddr, publicMode, sendBlinding, treeIndex) {
    const {ntru} = this;
    const isMint = publicMode === 1;
    const isBurn = publicMode === 2;

    treeIndex = treeIndex || 0;
    sendBlinding = sendBlinding || genRandomBabyJubValue();
    const noteMsg = [
      expandArray(bigintToBits(tokenAddr), 160, 0),
      expandArray(bigintToBits(sendAmount), 256, 0),
      expandArray(bigintToBits(sendBlinding), 256, 0),
    ].flat();
    // Pad out the message with ones to ensure it's always the full length
    while(noteMsg.length < ntru.N) {
      noteMsg.push(1);
    }

    let leaves = [];
    if(chainId in this.incoming && treeIndex in this.incoming[chainId]) {
      leaves = this.incoming[chainId][treeIndex].found.map(item => BigInt(item.receiveTxHash));
    }
    // Index doesn't matter for treeRoot calculation
    const { treeSiblings, treeIndices, treeDepth, treeRoot } = genTree(leaves, 0);

    const contract = getContract({
      client,
      abi,
      address: byChain[chainId].PrivateToken,
    });
    let {privateKey, publicKey} = this.balanceKeypair();
    let account;
    if(isMint) {
      // The balances are ignored when mint,
      // private key must not match recipPublicKey, so as to not trigger false receive
      privateKey = genRandomBabyJubValue();
      // Fake balances to cover the send
      const oldBalanceNonce = genRandomBabyJubValue();
      account = [
        symmetricEncrypt(sendAmount, privateKey, oldBalanceNonce),
        oldBalanceNonce,
      ];
    } else {
      account = await contract.read.accounts([poseidon2([privateKey, tokenAddr]), publicKey]);
    }

    const registry = getContract({
      client,
      abi: registryAbi,
      address: byChain[chainId].KeyRegistry,
    });
    let hBytes;
    let recipPublicKey;
    if(!recipAddr) {
      const selfPubs = this.registerTx(chainId).args[0];
      recipPublicKey = '0x' + selfPubs.slice(-64);
      hBytes = selfPubs.slice(0, -64);
    } else if(isBurn) {
      // TODO: Not used but needs to be calculated
      hBytes = '0x42424242';
      recipPublicKey = '0x42424242';
    } else {
      hBytes = await registry.read.data([recipAddr]);
      recipPublicKey = '0x' + hBytes.slice(-64);
      hBytes = hBytes.slice(0, -64);
    }
    const encSesh = this.fromPackedPublicKey(hBytes);
    // Receive proofs send a randomized, useless message
    const noteDataRaw = encSesh.ntru.encryptBits(!recipAddr ? bigintToBits(randomBigInt(2n ** BigInt(ntru.N))) : noteMsg);
    const noteDataHex = combineBigIntToHex(noteDataRaw.value.map(x=>BigInt(x)), Math.log2(ntru.q)+1);

    const newBalanceNonce = genRandomBabyJubValue();
    const balance = account[0] === 0n ? 0n : symmetricDecrypt(account[0], privateKey, account[1]);
    const finalBalance = symmetricEncrypt(
      balance - sendAmount,
      privateKey,
      newBalanceNonce
    );

    const inputs = {
      sendAmount,
      recipPublicKey,
      publicMode,
      encryptedBalance: account[0],
      oldBalanceNonce: account[1],
      newBalanceNonce,
      tokenAddr,
      chainId,
      sendBlinding,
      myPrivateKey: privateKey,
      fakeReceiveHash: genRandomBabyJubValue(),
      treeRootIfSend: treeRoot,
      treeIndex: 0,
      treeDepth,
      treeIndices,
      treeSiblings,
    };
    console.log(inputs, privateKey, poseidon1([privateKey]));

    const proof = await groth16.fullProve(
      inputs,
      'circuit/verify_circuit.wasm',
      'circuit/groth16_pkey.zkey',
    );

    if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate();

    const proofData = getCalldata(proof).flat().flat().reduce((out, cur) => out + cur.slice(2), '0x');
    // TODO generate correct noticeData
    const noticeData = '0x69';
    console.log(proofData);
    return {
      abi,
      address: byChain[chainId].PrivateToken,
      functionName: 'verifyProof',
      args: [ proofData, '0x' + noteDataHex ],
    };
  }
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


function splitHexToBigInt(hexString, bitLength) {
  // Remove the '0x' prefix if it exists
  hexString = hexString.startsWith('0x') ? hexString.slice(2) : hexString;

  // Ensure the hex string has an even number of characters for clean bit splitting
  if (hexString.length % 2 !== 0) {
    hexString = '0' + hexString; // Prepend a leading zero if necessary
  }

  // Convert the hex string to a binary string
  const binaryString = BigInt('0x' + hexString).toString(2).padStart(hexString.length * 4, '0');

  const result = [];

  // Iterate over the binary string and split it into chunks based on bitLength
  for (let i = 0; i < binaryString.length; i += bitLength) {
    const chunk = binaryString.slice(i, i + bitLength);
    const num = BigInt('0b' + chunk); // Convert the binary chunk to a decimal number
    result.push(num);
  }

  return result;
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

