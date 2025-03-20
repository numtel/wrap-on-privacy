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
import blockscoutUrls from 'blockscout-urls';

import NTRUWorkerWrapper from './NTRUWorkerWrapper.js';
import {
  genTree,
  getCalldata,
  genRandomBabyJubValue,
  SNARK_FIELD_SIZE,
  symmetricEncrypt,
  symmetricDecrypt,
  downloadTextFile,
  importJsonFile,
  randomBigInt,
} from './utils.js';
import abi from './abi/PrivateToken.json';
import scaledTokenAbi from './abi/ScaledToken.json';
import registryAbi from './abi/KeyRegistry.json';
import {defaultPool} from'./contracts.js';

export const SESH_KEY = 'private-token-session';

// IndexedDB is async but we want this answer synchronously
let hasStoredSesh = false;
getJSON().then((data) => {
  if(data) hasStoredSesh = true;
}).catch((error) => {
  console.error('Unexpected', error);
});

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
      outgoing: {},
      pools: [],
      colorScheme: {
        face: null,
        text: null,
        hover: null,
        highlight: null,
        etch: null,
        bevel1light: null,
        bevel1dark: null,
        bevel2light: null,
        bevel2dark: null,
        title1: null,
        title2: null,
        titleText: null,
        activeBg: null,
        activeBg2: null,
        activeText: null,
        textLight: null,
        toolbar: null,
        toolbarDisabled: null,
        toolbarAccent1: null,
        toolbarAccent2: null,
        thEtch: null,
        link: null,
        linkHover: null,
        banner: null,
        shadow: null,
      },
    }, options);

    this.ntru = new NTRUWorkerWrapper(this.ntru);

    if(this.pools.length === 0) {
      this.pools.push(defaultPool);
    }
  }
  async init() {
    if(this.ntru.f) {
      if(!this.ntru.fq || !this.ntru.fp) {
        await this.ntru.loadPrivateKeyF(this.ntru.f);
      }
      await this.ntru.verifyKeysInputs();
    } else if(!this.ntru.h) {
      await this.ntru.generatePrivateKeyF();
      await this.ntru.generateNewPublicKeyGH();
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
    hasStoredSesh = true;
    await storeJSON(JSON.stringify(data));
  }
  async download() {
    const data = await this.export();
    downloadTextFile(JSON.stringify(data), 'private-wallet.sesh');
  }
  static hasLocalStorage() {
    return hasStoredSesh;
  }
  static async loadFromLocalStorage(password, overwrite) {
    const data = JSON.parse(await getJSON());
    return PrivateTokenSession.import(data, password, overwrite);
  }
  static async import(data, password, overwrite) {
    const decrypted = JSON.parse(await decryptJson(data, password));
    Object.assign(decrypted, overwrite);
    const instance = new PrivateTokenSession(decrypted);
    await instance.init();
    return instance;
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
  async scanForIncoming(client, treeIndex, pool) {
    const contract = getContract({
      client,
      abi,
      address: pool.PrivateToken.address,
    });
    const count = Number(await contract.read.sendCount([treeIndex]));
    if(!(poolId(pool) in this.incoming)) this.incoming[poolId(pool)] = {};
    const oldCount = treeIndex in this.incoming[poolId(pool)] ? this.incoming[poolId(pool)][treeIndex].count : 0;
    return { count, oldCount };
  }
  async decryptIncoming(encValue, pool) {
    // Use a new worker for each decryption
    const ntru = new NTRUWorkerWrapper(this.ntru.state);

    const noteDataRev = splitHexToBigInt(encValue, Math.log2(ntru.q)+1).map(x=>Number(x));
    const decrypted = await ntru.decryptBits(trimPolynomial(noteDataRev));

    // Invalid decryption
    const failed = decrypted.value.some(x=>!(x===0 || x===1));
    if(failed) return null;

    const tokenAddr = bitsToBigInt(decrypted.value.slice(0, 160).reverse());
    const sendAmount = bitsToBigInt(decrypted.value.slice(160, 160+256).reverse());
    const sendBlinding = bitsToBigInt(decrypted.value.slice(160+256, 160 + 256*2).reverse());

    let {publicKey} = this.balanceKeypair();
    const hash = poseidon5([ tokenAddr, pool.PrivateToken.chain.id, sendAmount, sendBlinding, publicKey ]);

    return {tokenAddr, sendAmount, sendBlinding, hash};
  }
  async receiveTx(pool, treeIndex, item, client, registryClient) {
    return await this.sendPrivateTx(
      BigInt(item.sendAmount),
      BigInt(item.tokenAddr),
      pool,
      client,
      registryClient,
      null, // recipAddr,
      0, // publicMode,
      BigInt(item.sendBlinding),
      treeIndex,
      item.index,
      true, // skipScale
    );
  }
  async setLastScanned(treeIndex, pool, index, newItem) {
    if(!(poolId(pool) in this.incoming)) this.incoming[poolId(pool)] = {};
    if(!(treeIndex in this.incoming[poolId(pool)])) {
      this.incoming[poolId(pool)][treeIndex] = { found: [] };
    }
    this.incoming[poolId(pool)][treeIndex].found[index] = newItem;
    await this.saveToLocalStorage();
  }
  balanceKeypair() {
    const {privateKey} = this;
    // Ensure correct length
    const publicKey = BigInt(('0x' + poseidon1([privateKey]).toString(16) + '00000000').slice(0, 66));
    return {publicKey, privateKey};
  }
  balanceViewTx(tokenAddr, pool) {
    if(!tokenAddr) return {};
    const {publicKey, privateKey} = this.balanceKeypair();
    return {
      abi,
      chainId: pool.PrivateToken.chain.id,
      address: pool.PrivateToken.address,
      functionName: 'accounts',
      args: [poseidon2([privateKey, tokenAddr]), publicKey],
    };
  }
  registerTx(pool) {
    const {ntru} = this;
    const hPacked = packOutput(ntru.q, ntru.N, ntru.h);
    const hBytes = combineBigIntToHex(hPacked.expected, hPacked.maxOutputBits);
    const {publicKey, privateKey} = this.balanceKeypair();
    const balancePubBytes = combineBigIntToHex([publicKey], 256);

    return {
      abi: registryAbi,
      chainId: pool.KeyRegistry.chain.id,
      address: pool.KeyRegistry.address,
      functionName: 'set',
      args: [ `0x${hBytes}${balancePubBytes}` ],
    };

  }
  async sendPrivateTx(sendAmount, tokenAddr, pool, client, registryClient, recipAddr, publicMode, sendBlinding, treeIndex, itemIndex, skipScale) {
    const {ntru} = this;
    const isMint = publicMode === 1;
    const isBurn = publicMode === 2;
    // If token is atoken then sendAmount needs to be scaled
    const token = getContract({
      client,
      abi: scaledTokenAbi,
      address: '0x' + tokenAddr.toString(16),
    });
    if(!skipScale) {
      try {
        const scaledTotalSupply = await token.read.scaledTotalSupply();
        const totalSupply = await token.read.totalSupply();
        sendAmount = sendAmount * scaledTotalSupply / totalSupply;
      } catch(error) {
        // No problem, it's not a scaled token
      }
    }

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
    if(poolId(pool) in this.incoming && treeIndex in this.incoming[poolId(pool)]) {
      leaves = this.incoming[poolId(pool)][treeIndex].found.map(item => BigInt(item.receiveTxHash));
    }
    // itemIndex not needed for send proofs
    const { treeSiblings, treeIndices, treeDepth, treeRoot } = genTree(leaves, itemIndex || 0);

    const contract = getContract({
      client,
      abi,
      address: pool.PrivateToken.address,
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
      client: registryClient,
      abi: registryAbi,
      address: pool.KeyRegistry.address,
    });
    let hBytes;
    let recipPublicKey;
    if(!recipAddr) {
      // Is a receive proof
      const selfPubs = this.registerTx(pool).args[0];
      recipPublicKey = '0x' + selfPubs.slice(-64);
      hBytes = selfPubs.slice(0, -64);
    } else if(isBurn) {
      // Not used but needs to be calculated
      const selfPubs = this.registerTx(pool).args[0];
      recipPublicKey = recipAddr;
      hBytes = selfPubs.slice(0, -64);
    } else {
      // Is a mint or send proof
      hBytes = await registry.read.data([recipAddr]);
      if(hBytes === '0x') throw new Error('Recipient does not have a public key registered.');
      recipPublicKey = '0x' + hBytes.slice(-64);
      hBytes = hBytes.slice(0, -64);
    }
    const encSesh = this.fromPackedPublicKey(hBytes);
    // Receive proofs send a randomized, useless message
    const noteDataRaw = await encSesh.ntru.encryptBits(!recipAddr ? bigintToBits(randomBigInt(2n ** BigInt(ntru.N))) : noteMsg);
    const noteDataHex = combineBigIntToHex(noteDataRaw.value.map(x=>BigInt(x)), Math.log2(ntru.q)+1);

    // Only store outgoing on mint or private send
    if(!isBurn && recipAddr) {
      const outItem = {
        tokenAddr,
        chainId: BigInt(pool.PrivateToken.chain.id),
        sendAmount,
        sendBlinding,
        recipPublicKey,
        hBytes,
        recipAddr,
        time: Math.floor(Date.now() / 1000),
        hash: poseidon5([
          tokenAddr,
          pool.PrivateToken.chain.id,
          sendAmount,
          sendBlinding,
          recipPublicKey
        ]),
      };
      for(let key of Object.keys(outItem)) {
        outItem[key] = typeof outItem[key] === 'bigint'
          ? '0x' + outItem[key].toString(16)
          : outItem[key];
      }
      if(!(poolId(pool) in this.outgoing)) {
        this.outgoing[poolId(pool)] = [outItem];
      } else {
        this.outgoing[poolId(pool)].push(outItem);
      }
      await this.saveToLocalStorage();
    }

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
      chainId: BigInt(pool.PrivateToken.chain.id),
      sendBlinding,
      myPrivateKey: privateKey,
      fakeReceiveHash: genRandomBabyJubValue(),
      treeRootIfSend: treeRoot,
      treeIndex: 0,
      treeDepth,
      treeIndices,
      treeSiblings,
    };

    const proof = await groth16.fullProve(
      inputs,
      'circuit/verify_circuit.wasm',
      'circuit/groth16_pkey.zkey',
    );

    if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate();

    const proofData = getCalldata(proof).flat().flat().reduce((out, cur) => out + cur.slice(2), '0x');
    return {
      abi,
      chain: pool.PrivateToken.chain,
      address: pool.PrivateToken.address,
      functionName: 'verifyProof',
      args: [ proofData, '0x' + noteDataHex ],
    };
  }
  async importIncoming(pool) {
    const incoming = await importJsonFile();
    if(!incoming.sendAmount || !incoming.sendBlinding || !incoming.tokenAddr || !incoming.recipPublicKey) {
      throw new Error('Invalid JSON data!');
    }
    // Pad the end in case of trailing zeros getting trimmed
    const publicKey = ('0x' + this.balanceKeypair().publicKey.toString(16) + '000000000').slice(0, 66);
    if(incoming.recipPublicKey !== publicKey) {
      throw new Error('Recipient key mismatch!');
    }

    // TODO: support treeIndex
    const treeIndex = 0;

    if(poolId(pool) in this.incoming && treeIndex in this.incoming[poolId(pool)]) {
      const found = this.incoming[poolId(pool)][treeIndex].found;
      for(let i = 0; i < found.length; i++) {
        if(BigInt(found[i].receiveTxHash) === BigInt(incoming.hash)) {
          incoming.index = found[i].index;
        }
      }
    }
    if(incoming.index === undefined) {
      throw new Error('Hash not found in tree!');
    }

    return {incoming};
  }
}

export function explorerUrl(chain) {
  if(chain.id in blockscoutUrls) return `https://${blockscoutUrls[chain.id]}`;
  return chain.blockExplorers.default.url;
}

export function poolId(pool) {
  return `${pool.PrivateToken.address}:${pool.PrivateToken.chain.id}`;
}

function combineBigIntToHex(bigints, maxBits) {
    if (!Array.isArray(bigints) || !bigints.every(b => typeof b === 'bigint')) {
        throw new TypeError('Input must be an array of BigInt values.');
    }
    if (typeof maxBits !== 'number' || maxBits <= 0 || !Number.isInteger(maxBits)) {
        throw new TypeError('maxBits must be a positive integer.');
    }

    const totalBits = bigints.length * maxBits;
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
    // Calculate the exact hex length needed to represent totalBits bits
    let hexLength = Math.ceil(totalBits / 4);
    // Eth RPCs don't return odd-length hex strings
    if(hexLength % 2 !== 0) hexLength++;
    // Pad on the left to ensure the hex string encodes exactly totalBits bits
    combinedHex = combinedHex.padStart(hexLength, '0');

    return combinedHex;
}

function splitHexToBigInt(hexString, bitLength) {
  // Remove the '0x' prefix if it exists
  hexString = hexString.startsWith('0x') ? hexString.slice(2) : hexString;

  // Ensure the hex string has an even number of characters for clean bit splitting
  if (hexString.length % 2 !== 0) {
    hexString = '0' + hexString; // Prepend a leading zero if necessary
  }

  const totalHexBits = hexString.length * 4;
  // Convert hex string to binary string, padding to the full bit length encoded by the hex string
  const binaryString = BigInt('0x' + hexString).toString(2).padStart(totalHexBits, '0');

  // Calculate the number of extra bits (from left padding) that were added
  const extraBits = totalHexBits % bitLength;
  // Remove these extra bits to get back the original combined binary string
  const effectiveBinaryString = binaryString.slice(extraBits);

  const result = [];
  // Split the effective binary string into chunks of the original bitLength
  for (let i = 0; i < effectiveBinaryString.length; i += bitLength) {
    const chunk = effectiveBinaryString.slice(i, i + bitLength);
    const num = BigInt('0b' + chunk);
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

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("WrapOnPrivacy", 1);

        request.onupgradeneeded = (event) => {
            let db = event.target.result;
            if (!db.objectStoreNames.contains("jsonStore")) {
                db.createObjectStore("jsonStore", { keyPath: "id" });
            }
        };

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

export function storeJSON(data) {
    return openDatabase().then((db) => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction("jsonStore", "readwrite");
            const store = transaction.objectStore("jsonStore");
            const request = store.put({ id: SESH_KEY, data });

            request.onsuccess = () => resolve("Data stored successfully");
            request.onerror = (event) => reject(event.target.error);
        });
    });
}

function getJSON() {
    return openDatabase().then((db) => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction("jsonStore", "readonly");
            const store = transaction.objectStore("jsonStore");
            const request = store.get(SESH_KEY);

            request.onsuccess = () => resolve(request.result ? request.result.data : null);
            request.onerror = (event) => reject(event.target.error);
        });
    });
}

