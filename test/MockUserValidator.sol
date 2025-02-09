// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

contract MockUserValidator {
  bool public retval;

  function setRetval(bool newVal) external {
    retval = newVal;
  }

  function isUserValid(address) external view returns(bool) {
    return retval;
  }
}
