pragma circom 2.1.5;

include "poseidon.circom";
include "comparators.circom";
include "control-flow.circom";
include "binary-merkle-root.circom";
include "encryption-symmetric.circom";

template PrivacyToken_Poseidon(MAX_AMOUNT_BITS, MAX_DEPTH) {
  // private signals
  signal input tokenAddr;
  signal input sendAmount;
  signal input sendBlinding;
  signal input recipPublicKey;
  signal input myPrivateKey;
  signal input fakeReceiveHash;
  signal input treeDepth, treeIndices[MAX_DEPTH], treeSiblings[MAX_DEPTH];
  signal input treeRootIfSend;
  // public signals
  signal input treeIndex;
  signal input publicMode; // 1 = mint, 2 = burn
  signal input chainId;
  signal input encryptedBalance;
  signal input oldBalanceNonce;
  signal input newBalanceNonce;

  signal output receiveNullifier;
  signal output newBalance;
  signal output myPublicKey;
  signal output treeRoot;
  signal output hash;
  signal output publicTokenAddr;
  signal output publicAddress;
  signal output publicAmount;

  myPublicKey <== Poseidon(1)([myPrivateKey]);
  var isReceive = IsEqual()([ myPublicKey, recipPublicKey ]);

  // Decrypt balance unless this account has not yet initialized a balance
  var oldBalance = IfElse()(
    IsZero()(encryptedBalance),
    0,
    SymmetricDecrypt()(encryptedBalance, myPrivateKey, oldBalanceNonce)
  );

  // oldBalance >= sendAmount
  component validSendAmount = LessThan(MAX_AMOUNT_BITS);
  validSendAmount.in[0] <== oldBalance;
  validSendAmount.in[1] <== sendAmount;
  component isValidSendAmountOrIsReceive = IfElse();
  isValidSendAmountOrIsReceive.cond <== isReceive;
  isValidSendAmountOrIsReceive.ifTrue <== 0;
  isValidSendAmountOrIsReceive.ifFalse <== validSendAmount.out;
  isValidSendAmountOrIsReceive.out === 0;

  component updateBalance = IfElse();
  updateBalance.cond <== isReceive;
  updateBalance.ifTrue <== oldBalance + sendAmount;
  updateBalance.ifFalse <== oldBalance - sendAmount;

  component encryptNewBalance = SymmetricEncrypt();
  encryptNewBalance.message <== updateBalance.out;
  encryptNewBalance.key <== myPrivateKey;
  encryptNewBalance.nonce <== newBalanceNonce;
  encryptNewBalance.encryptedMessage ==> newBalance;

  receiveNullifier <== Poseidon(6)([
    tokenAddr,
    chainId,
    sendAmount,
    sendBlinding,
    recipPublicKey,
    myPrivateKey
  ]);
  var txHash = Poseidon(5)([
    tokenAddr,
    chainId,
    sendAmount,
    sendBlinding,
    recipPublicKey
  ]);
  component outputHash = IfElse();
  outputHash.cond <== isReceive;
  outputHash.ifTrue <== fakeReceiveHash;
  outputHash.ifFalse <== txHash;
  outputHash.out ==> hash;

  var calcTreeRoot = BinaryMerkleRoot(MAX_DEPTH)(txHash, treeDepth, treeIndices, treeSiblings);
  treeRoot <== IfElse()(isReceive, calcTreeRoot, treeRootIfSend);

  // Ensure at least one constraint for these signals
  signal pubSq <== publicMode * publicMode;
  signal idxSq <== treeIndex * treeIndex;

  var isPrivate = IsZero()(publicMode);
  publicTokenAddr <== IfElse()(isPrivate, 0, tokenAddr);
  publicAddress <== IfElse()(isPrivate, 0, recipPublicKey);
  publicAmount <== IfElse()(isPrivate, 0, sendAmount);

}
