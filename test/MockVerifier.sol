// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "../contracts/IPrivateToken.sol";

contract MockVerifier {
  function verifyProof(uint[2] calldata, uint[2][2] calldata, uint[2] calldata, uint[nPub] calldata) external pure returns (bool) {
    return true;
  }
}
