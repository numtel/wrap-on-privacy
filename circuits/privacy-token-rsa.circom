pragma circom 2.1.5;

include "control-flow.circom";
include "pow_mod.circom";

// w: bits per word
// nb: public key word count
template PrivacyToken_RSA(w, nb) {
  var MAX_DEPTH = 32;

  // Always use 65537 as exponent
  var e_bits = 17;

  // support full erc20 max amount
  var uint256 = 256\w + (256%w > 0 ? 1 : 0);

  // Private signals
//   signal input treeDepth, treeIndices[MAX_DEPTH], treeSiblings[MAX_DEPTH];
//   signal input isBurn;
  signal input isSend; // 1 = send, 0 = receive
  signal input sendAmount[uint256];
  signal input sendBlinding[uint256];
  signal input recipPublicKey[nb];
  signal input encChunks[nb];
  // Public signals
//   signal input tokenAddr;
//   signal input chainId;
// 
//   signal input encryptedBalance[uint256];
//   signal input balanceNonce;
//   signal input newBalanceNonce;
  signal input balanceIn[uint256];
  signal output balanceOut[uint256];
//   signal output treeRoot;
//   signal output finalBalance;
//   signal output receiveNullifier;
//   signal output encryptedAmountSent[nb];

  component deltaSwitch[uint256];
  component balanceAfterSend = BigSub(w, uint256);
  balanceAfterSend.a <== balanceIn;
  component balanceAfterReceive = BigAdd(w, uint256);
  balanceAfterReceive.a <== balanceIn;
  for(var i = 0; i < uint256; i++) {
    deltaSwitch[i] = Switch();
    deltaSwitch[i].cond <== isSend;
    deltaSwitch[i].in[0] <== sendAmount[i];
    deltaSwitch[i].in[1] <== 0;
    balanceAfterSend.b[i] <== deltaSwitch[i].out[1];
    balanceAfterReceive.b[i] <== deltaSwitch[i].out[0];
  }

  // No underflow
  balanceAfterSend.underflow === 0;
  // No overflow
  balanceAfterReceive.out[uint256] === 0;

  // balanceOut = isSend ? balanceAfterSend : balanceAfterReceive
  for(var i = 0; i < uint256; i++) {
    balanceOut[i] <== isSend * (balanceAfterSend.out[i] - balanceAfterReceive.out[i]) + balanceAfterReceive.out[i];
  }

  var base[nb];
  for(var i = 0; i < uint256; i++) {
    base[i] = sendAmount[i];
    base[i + uint256] = sendBlinding[i];
  }

  component powMod = PowerMod(w, nb, e_bits);
  powMod.base <== base;
  powMod.exp[0] <== 65537;
  for(var i = 1; i < nb; i++) {
    powMod.exp[i] <== 0;
  }
  powMod.modulus <== recipPublicKey;
  powMod.out === encChunks;



}
