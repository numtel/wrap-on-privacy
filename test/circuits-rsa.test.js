import { strictEqual } from "node:assert";
import { Circomkit } from "circomkit";
import { LeanIMT } from "@zk-kit/imt";
import { poseidon2 } from "poseidon-lite";

import {
  rsaEncrypt,
  rsaDecrypt,
  stringToBigInt,
  bigIntToString,
  generateRSAKeys,
  splitBigIntByBits,
  combineBigIntChunks,
  expandArray,
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

describe("rsa-privacy-token", () => {
  it("encrypts a value", async () => {
    const uint256Max = (1n << 256n) - 1n;

    // Circuit config
    const rsaSize = 1024;
    // 120 seems to be the fastest word size even though the constraint count is higher than 64?
    const circuitWordSize = 120;

    // Test case config
    const sendAmount = 1234568n;
    const sendBlinding = randomBigInt(uint256Max);
    // just enough space if it's a receive
    const balanceIn = uint256Max - sendAmount;
    const balanceOutSend = balanceIn - sendAmount;
    const balanceOutReceive = balanceIn + sendAmount;
    const isSend = 1;

    // Array size constants
    const wordCount = Math.ceil(rsaSize / circuitWordSize);
    const u256Count = Math.ceil(256 / circuitWordSize);

    // Construct circuit input values
    const sendChunks = expandArray(splitBigIntByBits(sendAmount, circuitWordSize), u256Count, 0n);
    const blindingChunks = expandArray(splitBigIntByBits(sendBlinding, circuitWordSize), u256Count, 0n);
    const messageChunks = expandArray([...sendChunks, ...blindingChunks], wordCount, 0n);
    const messageValue = combineBigIntChunks(messageChunks, circuitWordSize);

    // Perform encryption
    const { publicKey, privateKey, e, n, d } = await generateRSAKeys(rsaSize);
    const ciphertext = rsaEncrypt(messageValue, { e, n });
    const decryptedValue = rsaDecrypt(ciphertext, { d, n });
    // Test the javascript implementation too
    strictEqual(decryptedValue, messageValue);

    const circuit = await circomkit.WitnessTester(`privtokenrsa`, {
      file: "privacy-token-rsa",
      template: "PrivacyToken_RSA",
      dir: "test/privtokenrsa",
      params: [circuitWordSize, wordCount],
    });

    const input = {
      balanceIn: expandArray(splitBigIntByBits(balanceIn, circuitWordSize), u256Count, 0n),
      sendAmount: sendChunks,
      sendBlinding: blindingChunks,
      recipPublicKey: splitBigIntByBits(n, circuitWordSize),
      encChunks: splitBigIntByBits(ciphertext, circuitWordSize),
      isSend,
    };
    await circuit.expectPass(input, {
      balanceOut: expandArray(splitBigIntByBits(isSend ? balanceOutSend : balanceOutReceive, circuitWordSize), u256Count, 0n),
    });
  });
});
