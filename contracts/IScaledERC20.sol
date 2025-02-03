// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

interface IScaledERC20 is IERC20 {
  function scaledTotalSupply() external view returns (uint);
}

