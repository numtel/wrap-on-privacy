// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {PubSignals} from "../contracts/PrivacyToken.sol";

contract MockUserValidator {
  bool public retval;
  uint public counter;

  function setRetval(bool newVal) external {
    retval = newVal;
  }

  function isUserValid(address, PubSignals memory) external returns(bool) {
    counter++;
    return retval;
  }
}
