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

describe("merkle-tree", () => {
  it("verifies", async () => {
    const MAX_DEPTH = 20;
    const encAmount1 = 123n;
    const ephemKey1 = 234n;
    const encAmount2 = 223n;
    const ephemKey2 = 334n;

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
      params: [MAX_DEPTH],
    });

    await circuit.expectPass({
      encryptedAmountReceived: encAmount2,
      ephemeralKeyReceived: ephemKey2,
      treeDepth: tree.depth,
      treeIndices,
      treeSiblings,
    }, {
      treeRoot: tree.root,
    });
  });
});

describe("encryption-asymmetric", () => {
  it("encrypt-decrypt", async () => {
    const circuitEncrypt = await circomkit.WitnessTester(`asymmetricencrypt`, {
      file: "encryption-asymmetric",
      template: "AsymmetricEncrypt",
      dir: "test/encryption-asymmetric",
    });
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
    const {encryptedMessage, ephemeralKey} = await circuitEncrypt.compute(
      {secret, publicKey, nonce},
      ['encryptedMessage', 'ephemeralKey']
    );
    await circuitDecrypt.expectPass(
      { encryptedMessage, ephemeralKey, privateKey },
      // decrypted value is encoded
      { decryptedMessage: F.pow(BASE, secret) }
    );
  });
});

describe("encryption-symmetric", () => {
  it("encrypt-decrypt", async () => {
    const circuitEncrypt = await circomkit.WitnessTester(`symmetricencrypt`, {
      file: "encryption-symmetric",
      template: "SymmetricEncrypt",
      dir: "test/encryption-symmetric",
    });
    const circuitDecrypt = await circomkit.WitnessTester(`symmetricdecrypt`, {
      file: "encryption-symmetric",
      template: "SymmetricDecrypt",
      dir: "test/encryption-symmetric",
    });

    const message = 123456n;
    const key = 23456n;
    const nonce = 34567n;

    // Can encrypt and decrypt back to the same value
    const {encryptedMessage} = await circuitEncrypt.compute({message, key, nonce}, ['encryptedMessage']);
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
