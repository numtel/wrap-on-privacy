//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Adjust based on key size
uint256 constant MAX_SEND = 131072;
uint256 constant nO = 3;
uint256 constant nPub = nO + 7;
uint256 constant nPubMint = nO + 1;

interface IPrivateToken {

  struct PrivateAccount {
    uint256 encryptedBalance;
    uint256 nonce;
  }

  struct PubSignals {
    uint256 publicKey;
    uint256 treeRoot;
    uint256 finalBalance;
    uint256 receiveNullifier;
    uint256[nO] encryptedAmountSent;
    uint256 encryptedBalance;
    uint256 balanceNonce;
    uint256 newBalanceNonce;
    uint256 tokenAddr;
    uint256 chainId;
  }

  error PrivateToken__InvalidChainId();
  error PrivateToken__InvalidProof();
  error PrivateToken__DuplicateNullifier();
  error PrivateToken__InvalidBalance();
  error PrivateToken__InvalidBalanceNonce();
  error PrivateToken__InvalidTreeRoot();
  error PrivateToken__InvalidAmount();
  error PrivateToken__InvalidNewBalance();
  error PrivateToken__InvalidNewBalanceNonce();

//   function sendCount() external view returns (uint256);
//   function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[9] calldata _pubSignals) external;
}
