// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import "../contracts/PrivateToken.sol";
import "./MockVerifier.sol";
import "./MockMintVerifier.sol";
import "./MockERC20.sol";

contract PrivateTokenTest is Test, IPrivateToken {
  PrivateToken public wrapper;
  MockERC20 public token;
  uint public tokenAddr;
  MockVerifier public verifier;
  MockMintVerifier public mintVerifier;

  error TestError();

  function setUp() public {
    token = new MockERC20();
    tokenAddr = uint256(uint160(address(token)));
    verifier = new MockVerifier();
    mintVerifier = new MockMintVerifier();
    wrapper = new PrivateToken(address(verifier), address(mintVerifier));
  }

  function test_Mint() public {
    uint privateAmount = 10;
    uint publicKey = 5678;
    uint encBalance = 6789;

    token.mint(privateAmount);
    token.approve(address(wrapper), privateAmount + 1);
    assertEq(token.balanceOf(address(this)), privateAmount);

    // Cannot mint more than balance
    try wrapper.mint([uint(0),0], [[uint(0),0],[uint(0),0]], [uint(0),0], [
      uint(123),
      123,
      123,
      privateAmount + 1,
      tokenAddr,
      block.chainid
    ]) {
      revert TestError();
    } catch {
      // Expecting an error
    }

    wrapper.mint([uint(0),0], [[uint(0),0],[uint(0),0]], [uint(0),0], [
      uint(123),
      123,
      123,
      privateAmount,
      tokenAddr,
      block.chainid
    ]);

    // Cannot re-use the same encryptedAmountSent as the mint above
    try wrapper.verifyProof([uint(0),0], [[uint(0),0],[uint(0),0]], [uint(0),0], [
      publicKey,
      wrapper.treeRoot(address(token)),
      encBalance,
      123123, // receiveNullifier,
      123, // encryptedAmountSent[0]
      123, // encryptedAmountSent[1]
      123, // encryptedAmountSent[2]
      0, // ogBalance,
      0, // balanceNonce,
      123, //newBalanceNonce,
      tokenAddr,
      block.chainid
    ]) {
      revert TestError();
    } catch {
      // Expecting an error
    }

		// Accept a tranasction and send to another account
    wrapper.verifyProof([uint(0),0], [[uint(0),0],[uint(0),0]], [uint(0),0], [
      publicKey,
      wrapper.treeRoot(address(token)),
      encBalance,
      123123, // receiveNullifier,
      123, // encryptedAmountSent[0]
      123, // encryptedAmountSent[1]
      124, // encryptedAmountSent[2]
      0, // ogBalance,
      0, // balanceNonce,
      123, //newBalanceNonce,
      tokenAddr,
      block.chainid
    ]);
    assertEq(token.balanceOf(address(this)), 0);

    // Cannot burn more than the balance
    try wrapper.verifyProof([uint(0),0], [[uint(0),0],[uint(0),0]], [uint(0),0], [
      publicKey,
      wrapper.treeRoot(address(token)),
      encBalance,
      1231234, // receiveNullifier,
      1, // encryptedAmountSent[0]
      privateAmount + 1, // encryptedAmountSent[1]
      uint(uint160(address(this))), // encryptedAmountSent[2]
      encBalance, // ogBalance,
      123, // balanceNonce,
      1234, //newBalanceNonce,
      tokenAddr,
      block.chainid
    ]) {
      revert TestError();
    } catch {
      // Expecting an error
    }

		// Burn back to public
    wrapper.verifyProof([uint(0),0], [[uint(0),0],[uint(0),0]], [uint(0),0], [
      publicKey,
      wrapper.treeRoot(address(token)),
      encBalance,
      1231234, // receiveNullifier,
      1, // encryptedAmountSent[0]
      privateAmount, // encryptedAmountSent[1]
      uint(uint160(address(this))), // encryptedAmountSent[2]
      encBalance, // ogBalance,
      123, // balanceNonce,
      1234, //newBalanceNonce,
      tokenAddr,
      block.chainid
    ]);

    assertEq(token.balanceOf(address(this)), privateAmount);
  }
}

