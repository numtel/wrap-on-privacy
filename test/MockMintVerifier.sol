// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "../contracts/IPrivateToken.sol";

contract MockMintVerifier {
  function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[nPubMint] calldata _pubSignals) external view returns (bool) {
    return true;
  }
}

