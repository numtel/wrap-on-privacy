//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPrivateToken {
  struct PrivateSend {
    uint256 encryptedAmount;
    uint256 ephemeralKey;
  }

  struct PrivateAccount {
    uint256 encryptedBalance;
    uint256 nonce;
  }

  struct PubSignals {
    uint256 publicKey;
    uint256 treeRoot;
    uint256 encryptedAmountSent;
    uint256 sendEphemeralKey;
    uint256 finalBalance;
    uint256 receiveNullifier;
    uint256 encryptedBalance;
    uint256 balanceNonce;
    uint256 newBalanceNonce;
  }

  error PrivateToken__InvalidProof();
  error PrivateToken__DuplicateNullifier();
  error PrivateToken__InvalidBalance();
  error PrivateToken__InvalidBalanceNonce();
  error PrivateToken__InvalidTreeRoot();

  function sendCount() external view returns (uint256);
  function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[9] calldata _pubSignals) external;
}
