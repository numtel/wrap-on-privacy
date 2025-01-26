// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

contract MockPrivacyVerifier {
  function verifyProof(uint[2] calldata, uint[2][2] calldata, uint[2] calldata, uint[15] calldata) external pure returns (bool) {
    return true;
  }
}
