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

template PrivacyToken(MAX_DEPTH, MAX_AMOUNT_BITS, MAX_SEND_AMOUNT) {
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
  signal input isBurn;
  signal input isReceiving;
  // when the treeDepth=0 (it's a proof that doesn't receive), the valid tree root is passed here
  signal input nonReceivingTreeRoot;

  signal output publicKey;
  signal output treeRoot;
  signal output encryptedAmountSent;
  signal output sendEphemeralKey;
  signal output finalBalance;
  signal output receiveNullifier;

  publicKey <== Exponentiate()(2, privateKey);

  var decryptedBalance = SymmetricDecrypt()(encryptedBalance, privateKey, balanceNonce);

  var receiveTxHash = Poseidon(2)([encryptedAmountReceived, ephemeralKeyReceived]);

  var calcTreeRoot = BinaryMerkleRoot(MAX_DEPTH)(receiveTxHash, treeDepth, treeIndices, treeSiblings);
  treeRoot <== IfElse()(isReceiving, calcTreeRoot, nonReceivingTreeRoot);

  var decryptedAmountReceived = AsymmetricDecrypt()(privateKey, ephemeralKeyReceived, encryptedAmountReceived);
  var checkDecryptedAmountReceived = Exponentiate()(2, decodedAmountReceived);
  decryptedAmountReceived === checkDecryptedAmountReceived;

  var newBalanceIfReceiving = decryptedBalance + decodedAmountReceived;
  var newBalanceRaw = IfElse()(isReceiving, newBalanceIfReceiving, decryptedBalance);

  component validSendAmount = LessThan(MAX_AMOUNT_BITS);
  validSendAmount.in[0] <== newBalanceRaw;
  validSendAmount.in[1] <== sendAmount;
  validSendAmount.out === 0;

  component underMaxSendAmount = LessThan(MAX_AMOUNT_BITS);
  underMaxSendAmount.in[0] <== MAX_SEND_AMOUNT;
  underMaxSendAmount.in[1] <== sendAmount;
  underMaxSendAmount.out === 0;

  component sendEncrypter = AsymmetricEncrypt();
  sendEncrypter.secret <== sendAmount;
  sendEncrypter.publicKey <== recipPubKey;
  sendEncrypter.nonce <== sendNonce;
  var ephemKeyIfNotBurn = sendEncrypter.ephemeralKey;
  var encAmtSentIfNotBurn = sendEncrypter.encryptedMessage;

  encryptedAmountSent <== IfElse()(isBurn, sendAmount, encAmtSentIfNotBurn);
  // Output recip address if it's a burn as the ephemeral key
  sendEphemeralKey <== IfElse()(isBurn, recipPubKey, ephemKeyIfNotBurn);

  var finalBalanceRaw = newBalanceRaw - sendAmount;
  finalBalance <== SymmetricEncrypt()(finalBalanceRaw, privateKey, newBalanceNonce);

  receiveNullifier <== Poseidon(2)([ receiveTxHash, privateKey ]);

  // A proof must at least send or receive, it can't be a no-op spamming the tree
  component notNoop = AND();
  notNoop.a <== IsZero()(sendAmount);
  notNoop.b <== IsZero()(isReceiving);
  notNoop.out === 0;

}

