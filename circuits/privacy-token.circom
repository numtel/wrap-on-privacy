pragma circom 2.1.5;

include "babyjub.circom";
include "poseidon.circom";
include "binary-merkle-root.circom";

include "exponentiate.circom";

template PrivacyToken(MAX_DEPTH) {
//   signal input privateKey;
  signal input encryptedAmountReceived;
  signal input ephemeralKeyReceived;
  signal input treeDepth, treeIndices[MAX_DEPTH], treeSiblings[MAX_DEPTH];

  signal output treeRoot;

//   var pubKey = Exponentiate()(2, privateKey);
  var receiveTxHash = Poseidon(2)([encryptedAmountReceived, ephemeralKeyReceived]);

  treeRoot <== BinaryMerkleRoot(MAX_DEPTH)(receiveTxHash, treeDepth, treeIndices, treeSiblings);

}

