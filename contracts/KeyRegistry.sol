//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract KeyRegistry {
  mapping(address => bytes) public data;
  function set(bytes memory val) external {
    data[msg.sender] = val;
  }
}

