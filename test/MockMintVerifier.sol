// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

contract MockMintVerifier {
  function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[3] calldata _pubSignals) external view returns (bool) {
    return true;
  }
}

