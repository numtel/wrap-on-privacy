// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
  constructor() ERC20("test", "test") {}

  function mint(uint amount) external {
    _mint(msg.sender, amount);
  }
}

