pragma circom 2.1.5;

include "babyjub.circom";
include "gates.circom";
include "poseidon.circom";
include "comparators.circom";
include "binary-merkle-root.circom";

include "control-flow.circom";
include "exponentiate.circom";
include "encryption-symmetric.circom";
include "encryption-asymmetric.circom";

template PrivacyToken(MAX_DEPTH, MAX_AMOUNT_BITS) {
  signal input privateKey;
  signal input encryptedBalance;
  signal input balanceNonce;
  signal input newBalanceNonce;
  signal input decodedAmountReceived;
  signal input encryptedAmountReceived;
  signal input ephemeralKeyReceived;
  signal input treeDepth, treeIndices[MAX_DEPTH], treeSiblings[MAX_DEPTH];
  signal input sendAmount;
  signal input sendNonce;
  signal input recipPubKey;
  // when the treeDepth=0 (it's a proof that doesn't receive), the valid tree root is passed here
  signal input nonReceivingTreeRoot;

  signal output treeRoot;
  signal output encryptedAmountSent;
  signal output sendEphemeralKey;
  signal output finalBalance;
  signal output receiveNullifier;

  var pubKey = Exponentiate()(2, privateKey);

  var decryptedBalance = SymmetricDecrypt()(encryptedBalance, privateKey, balanceNonce);

  var receiveTxHash = Poseidon(2)([encryptedAmountReceived, ephemeralKeyReceived]);

  var notReceiving = IsZero()(treeDepth);
  var calcTreeRoot = BinaryMerkleRoot(MAX_DEPTH)(receiveTxHash, treeDepth, treeIndices, treeSiblings);
  treeRoot <== IfElse()(notReceiving, nonReceivingTreeRoot, calcTreeRoot);

  var decryptedAmountReceived = AsymmetricDecrypt()(privateKey, ephemeralKeyReceived, encryptedAmountReceived);
  var checkDecryptedAmountReceived = Exponentiate()(2, decodedAmountReceived);
  decryptedAmountReceived === checkDecryptedAmountReceived;

  var newBalanceIfReceiving = decryptedBalance + decodedAmountReceived;
  var newBalanceRaw = IfElse()(notReceiving, decryptedBalance, newBalanceIfReceiving);

  var sendAmountValid = LessThan(MAX_AMOUNT_BITS)([ newBalanceRaw, sendAmount ]);
  sendAmountValid === 0;

  component sendEncrypter = AsymmetricEncrypt();
  sendEncrypter.secret <== sendAmount;
  sendEncrypter.publicKey <== recipPubKey;
  sendEncrypter.nonce <== sendNonce;
  sendEncrypter.ephemeralKey ==> sendEphemeralKey;
  sendEncrypter.encryptedMessage ==> encryptedAmountSent;

  var finalBalanceRaw = newBalanceRaw - sendAmount;
  finalBalance <== SymmetricEncrypt()(finalBalanceRaw, privateKey, newBalanceNonce);

  receiveNullifier <== Poseidon(2)([ receiveTxHash, privateKey ]);

  // A proof must at least send or receive, it can't be a no-op spamming the tree
  var didntSendOrReceive = AND()(IsZero()(sendAmount), IsZero()(treeDepth));
  didntSendOrReceive === 0;
}

