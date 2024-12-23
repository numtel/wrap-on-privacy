pragma circom 2.1.5;

include "babyjub.circom";
include "gates.circom";
include "poseidon.circom";
include "comparators.circom";
include "binary-merkle-root.circom";
include "ntru.circom";

include "control-flow.circom";
include "encryption-symmetric.circom";

template PrivacyToken(
  MAX_DEPTH,
  MAX_AMOUNT_BITS,
  MAX_SEND_AMOUNT,
  q,
  nq,
  p,
  np,
  N,
  log2q,
  outPartBits,
  nO,
  packLen,
  privKeySize
) {
  signal input encryptedBalance;
  signal input balanceNonce;
  signal input newBalanceNonce;

  signal input encryptedReceive[nO];
  signal input f[N];
  signal input fp[N];
  signal input quotientFp[N+1];
  signal input remainderFp[N+1];
  signal input receiveQuotient1[N+1];
  signal input receiveRemainder1[N+1];
  signal input receiveQuotient2[N+1];
  signal input receiveRemainder2[N+1];

  signal input treeDepth, treeIndices[MAX_DEPTH], treeSiblings[MAX_DEPTH];
  signal input sendAmount;
  signal input recipH[N];
  signal input sendR[N];
  signal input sendQuotient[N+1];
  signal input sendRemainder[N+1];
  // burnAddress will be an ethereum address if isBurn=1, otherwise unsed
  signal input burnAddress;
  signal input isBurn;
  signal input isReceiving;
  signal input nonReceivingTreeRoot;

  signal output publicKey;
  signal output treeRoot;
  signal output encryptedAmountSent[nO];
  signal output finalBalance;
  signal output receiveNullifier;

  // Step 1: Verify private key coherency

  // Input f uses a mod q while verifying fp needs mod p
  var fModP[N];
  // Remainder will be single 1
  remainderFp[0] === 1;
  for(var i = 0; i<N; i++) {
    // p is always 3 so the hardcoded 2s are fine
    fModP[i] = IfElse()(LessThan(nq)([f[i], 2]), f[i], 2);
    if(i>0) {
      remainderFp[i] === 0;
    }
  }
  remainderFp[N] === 0;

  VerifyInverse(p, np, N)(fModP, fp, quotientFp, remainderFp);


  // Step 2: Generate derivative of NTRU private key to use in poseidon encryption for balance
  var fModPLen126[privKeySize * 126];
  for(var i = 0; i<N; i++) {
    fModPLen126[i] = fModP[i];
  }

  var packedF[privKeySize] = CombineArray(2, 252, privKeySize * 126)(fModPLen126);
  var privateKey = Sum(privKeySize)(packedF);

  // Calculate the key hash to use for storing the balance
  var keyHash[privKeySize-1];
  keyHash[0] = Poseidon(2)([packedF[0], packedF[1]]);
  for(var i = 2; i<privKeySize; i++) {
    keyHash[i-1] = Poseidon(2)([keyHash[i-2], packedF[i]]);
  }
  publicKey <== keyHash[privKeySize-2];


  // Decrypt balance unless this account has not yet initialized a balance
  var decryptedBalance = IfElse()(
    IsZero()(encryptedBalance),
    0,
    SymmetricDecrypt()(encryptedBalance, privateKey, balanceNonce)
  );

  // Step 3: Ensure this incoming transaction is part of the set of all transactions

  // Calculate the hash of the incoming tx
  var receiveTxHash[nO-1];
  receiveTxHash[0] = Poseidon(2)([encryptedReceive[0], encryptedReceive[1]]);
  for(var i = 2; i<nO; i++) {
    receiveTxHash[i-1] = Poseidon(2)([receiveTxHash[i-2], encryptedReceive[i]]);
  }

  var calcTreeRoot = BinaryMerkleRoot(MAX_DEPTH)(receiveTxHash[nO-2], treeDepth, treeIndices, treeSiblings);
  treeRoot <== IfElse()(isReceiving, calcTreeRoot, nonReceivingTreeRoot);

  // Decrypt the incoming tx
  var receiveUnpacked[packLen] = UnpackArray(log2q, outPartBits, nO, packLen)(encryptedReceive);
  component receiveDecrypted = VerifyDecrypt(q, nq, p, np, N);
  receiveDecrypted.f <== f;
  receiveDecrypted.fp <== fp;
  for(var i = 0; i < N; i++) {
    receiveDecrypted.e[i] <== receiveUnpacked[i];
  }
  receiveDecrypted.quotient1 <== receiveQuotient1;
  receiveDecrypted.remainder1 <== receiveRemainder1;
  receiveDecrypted.quotient2 <== receiveQuotient2;
  receiveDecrypted.remainder2 <== receiveRemainder2;

  var amountReceivedBits[MAX_AMOUNT_BITS];
  for(var i = 0; i<N; i++) {
    if(i < MAX_AMOUNT_BITS) {
      amountReceivedBits[i] = receiveRemainder2[i];
    }
  }
  var amountReceived = Bits2Num(MAX_AMOUNT_BITS)(amountReceivedBits);

  var newBalanceIfReceiving = decryptedBalance + amountReceived;
  var newBalanceRaw = IfElse()(isReceiving, newBalanceIfReceiving, decryptedBalance);

  // Step 4: Prepare outgoing transaction
  component validSendAmount = LessThan(MAX_AMOUNT_BITS);
  validSendAmount.in[0] <== newBalanceRaw;
  validSendAmount.in[1] <== sendAmount;
  validSendAmount.out === 0;

  component underMaxSendAmount = LessThan(MAX_AMOUNT_BITS);
  underMaxSendAmount.in[0] <== MAX_SEND_AMOUNT;
  underMaxSendAmount.in[1] <== sendAmount;
  underMaxSendAmount.out === 0;

  var sendM[N] = Num2Bits(N)(sendAmount);

  component sendEncrypted = VerifyEncrypt(q, nq, N);
  sendEncrypted.r <== sendR;
  sendEncrypted.m <== sendM;
  sendEncrypted.h <== recipH;
  sendEncrypted.quotientE <== sendQuotient;
  sendEncrypted.remainderE <== sendRemainder;

  component packOutput = CombineArray(log2q, outPartBits, packLen);
  for(var i = 0; i<N; i++) {
    packOutput.in[i] <== sendRemainder[i];
  }
  for(var i = N; i < packLen; i++) {
    packOutput.in[i] <== 0;
  }
  var encAmountSentIfNotBurn[nO] = packOutput.out;

  // Optionally, burns will have their outgoing transaction data public
  var encAmountSentIfBurn[nO];
  encAmountSentIfBurn[0] = 1;
  encAmountSentIfBurn[1] = sendAmount;
  encAmountSentIfBurn[2] = burnAddress;

  for(var i = 0; i < nO; i++) {
    encryptedAmountSent[i] <== IfElse()(isBurn, encAmountSentIfBurn[i], encAmountSentIfNotBurn[i]);
  }

  // Store the final balance after input and output
  var finalBalanceRaw = newBalanceRaw - sendAmount;
  finalBalance <== SymmetricEncrypt()(finalBalanceRaw, privateKey, newBalanceNonce);

  // Don't allow this account to process the same incoming transaction twice
  receiveNullifier <== Poseidon(2)([ receiveTxHash[nO-2], privateKey ]);

  // A proof must at least send or receive, it can't be a no-op spamming the tree
  component notNoop = AND();
  notNoop.a <== IsZero()(sendAmount);
  notNoop.b <== IsZero()(isReceiving);
  notNoop.out === 0;

}

template PrivateMint(MAX_AMOUNT_BITS, MAX_SEND_AMOUNT, q, nq, N, log2q, outPartBits, nO, packLen) {
  signal input sendAmount;
  signal input recipH[N];
  signal input sendR[N];
  signal input quotientE[N+1];
  signal input remainderE[N+1];

  signal output encryptedSend[nO];

  var sendM[N] = Num2Bits(N)(sendAmount);

  component sendEncrypted = VerifyEncrypt(q, nq, N);
  sendEncrypted.r <== sendR;
  sendEncrypted.m <== sendM;
  sendEncrypted.h <== recipH;
  sendEncrypted.quotientE <== quotientE;
  sendEncrypted.remainderE <== remainderE;

  component underMaxSendAmount = LessThan(MAX_AMOUNT_BITS);
  underMaxSendAmount.in[0] <== MAX_SEND_AMOUNT;
  underMaxSendAmount.in[1] <== sendAmount;
  underMaxSendAmount.out === 0;

  component packOutput = CombineArray(log2q, outPartBits, packLen);
  for(var i = 0; i<N; i++) {
    packOutput.in[i] <== remainderE[i];
  }
  for(var i = N; i < packLen; i++) {
    packOutput.in[i] <== 0;
  }
  encryptedSend <== packOutput.out;
}
