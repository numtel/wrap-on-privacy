pragma circom 2.1.5;

include "babyjub.circom";
include "poseidon.circom";
include "comparators.circom";
include "binary-merkle-root.circom";

include "exponentiate.circom";
include "encryption-symmetric.circom";
include "encryption-asymmetric.circom";

template PrivacyToken(MAX_DEPTH, MAX_AMOUNT_BITS) {
  signal input privateKey;
  signal input encryptedBalance;
  signal input balanceNonce;
  signal input decodedAmountReceived;
  signal input encryptedAmountReceived;
  signal input ephemeralKeyReceived;
  signal input treeDepth, treeIndices[MAX_DEPTH], treeSiblings[MAX_DEPTH];
  signal input sendAmount;
  signal input sendNonce;
  signal input recipPubKey;

  signal output treeRoot;
  signal output decryptedBalance;
  signal output decryptedAmountReceived;
  signal output newBalanceRaw;
  signal output encryptedAmountSent;
  signal output sendEphemeralKey;
  signal output finalBalanceRaw;
  signal output receiveNullifier;

  var pubKey = Exponentiate()(2, privateKey);

  decryptedBalance <== SymmetricDecrypt()(encryptedBalance, privateKey, balanceNonce);

  var receiveTxHash = Poseidon(2)([encryptedAmountReceived, ephemeralKeyReceived]);

  treeRoot <== BinaryMerkleRoot(MAX_DEPTH)(receiveTxHash, treeDepth, treeIndices, treeSiblings);

  decryptedAmountReceived <== AsymmetricDecrypt()(privateKey, ephemeralKeyReceived, encryptedAmountReceived);
  var checkDecryptedAmountReceived = Exponentiate()(2, decodedAmountReceived);
  decryptedAmountReceived === checkDecryptedAmountReceived;

  newBalanceRaw <== decryptedBalance + decodedAmountReceived;

  var sendAmountValid = LessEqThan(MAX_AMOUNT_BITS)([ newBalanceRaw, sendAmount ]);
  sendAmountValid === 0;

  component sendEncrypter = AsymmetricEncrypt();
  sendEncrypter.secret <== sendAmount;
  sendEncrypter.publicKey <== recipPubKey;
  sendEncrypter.nonce <== sendNonce;
  sendEncrypter.ephemeralKey ==> sendEphemeralKey;
  sendEncrypter.encryptedMessage ==> encryptedAmountSent;

  finalBalanceRaw <== newBalanceRaw - sendAmount;

  receiveNullifier <== Poseidon(2)([ receiveTxHash, privateKey ]);

}

