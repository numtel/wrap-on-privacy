// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import "../contracts/PrivateToken.sol";
import "./MockVerifier.sol";
import "./MockERC20.sol";

contract PrivateTokenTest is Test, IPrivateToken {
  PrivateToken public wrapper;
  MockERC20 public token;
  MockVerifier public verifier;

  function setUp() public {
    token = new MockERC20();
    verifier = new MockVerifier();
    wrapper = new PrivateToken(address(token), 2, address(verifier));
  }

  function test_Mint() public {
    token.mint(1000);
    token.approve(address(wrapper), 1000);
    assertEq(token.balanceOf(address(this)), 1000);

    wrapper.mint(10, 1234, 111);
    assertEq(token.balanceOf(address(this)), 0);
  }

}

