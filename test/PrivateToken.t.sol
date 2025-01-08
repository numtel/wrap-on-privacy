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
      uint(123), // encryptedSend[0]
      123, // encryptedSend[1]
      123, // encryptedSend[2]
      123, // encryptedSend[3]
      123, // encryptedSend[4]
      123, // encryptedSend[5]
      123, // encryptedSend[6]
      123, // encryptedSend[7]
      123, // encryptedSend[8]
      123, // encryptedSend[9]
      123, // encryptedSend[10]
      123, // encryptedSend[11]
      123, // encryptedSend[12]
      123, // encryptedSend[13]
      123, // encryptedSend[14]
      123, // encryptedSend[15]
      123, // encryptedSend[16]
      123, // encryptedSend[17]
      123, // encryptedSend[18]
      123, // encryptedSend[19]
      123, // encryptedSend[20]
      123, // encryptedSend[21]
      123, // encryptedSend[22]
      123, // encryptedSend[23]
      123, // encryptedSend[24]
      tokenAddr,
      block.chainid,
      privateAmount + 1
    ]) {
      revert TestError();
    } catch {
      // Expecting an error
    }

    wrapper.mint([uint(0),0], [[uint(0),0],[uint(0),0]], [uint(0),0], [
      uint(123), // encryptedSend[0]
      123, // encryptedSend[1]
      123, // encryptedSend[2]
      123, // encryptedSend[3]
      123, // encryptedSend[4]
      123, // encryptedSend[5]
      123, // encryptedSend[6]
      123, // encryptedSend[7]
      123, // encryptedSend[8]
      123, // encryptedSend[9]
      123, // encryptedSend[10]
      123, // encryptedSend[11]
      123, // encryptedSend[12]
      123, // encryptedSend[13]
      123, // encryptedSend[14]
      123, // encryptedSend[15]
      123, // encryptedSend[16]
      123, // encryptedSend[17]
      123, // encryptedSend[18]
      123, // encryptedSend[19]
      123, // encryptedSend[20]
      123, // encryptedSend[21]
      123, // encryptedSend[22]
      123, // encryptedSend[23]
      123, // encryptedSend[24]
      tokenAddr,
      block.chainid,
      privateAmount
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
      123, // encryptedAmountSent[3]
      123, // encryptedAmountSent[4]
      123, // encryptedAmountSent[5]
      123, // encryptedAmountSent[6]
      123, // encryptedAmountSent[7]
      123, // encryptedAmountSent[8]
      123, // encryptedAmountSent[9]
      123, // encryptedAmountSent[10]
      123, // encryptedAmountSent[11]
      123, // encryptedAmountSent[12]
      123, // encryptedAmountSent[13]
      123, // encryptedAmountSent[14]
      123, // encryptedAmountSent[15]
      123, // encryptedAmountSent[16]
      123, // encryptedAmountSent[17]
      123, // encryptedAmountSent[18]
      123, // encryptedAmountSent[19]
      123, // encryptedAmountSent[20]
      123, // encryptedAmountSent[21]
      123, // encryptedAmountSent[22]
      123, // encryptedAmountSent[23]
      123, // encryptedAmountSent[24]
      tokenAddr,
      block.chainid,
      0, // ogBalance,
      0, // balanceNonce,
      123 //newBalanceNonce,
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
      123, // encryptedAmountSent[3]
      123, // encryptedAmountSent[4]
      123, // encryptedAmountSent[5]
      123, // encryptedAmountSent[6]
      123, // encryptedAmountSent[7]
      123, // encryptedAmountSent[8]
      123, // encryptedAmountSent[9]
      123, // encryptedAmountSent[10]
      123, // encryptedAmountSent[11]
      123, // encryptedAmountSent[12]
      123, // encryptedAmountSent[13]
      123, // encryptedAmountSent[14]
      123, // encryptedAmountSent[15]
      123, // encryptedAmountSent[16]
      123, // encryptedAmountSent[17]
      123, // encryptedAmountSent[18]
      123, // encryptedAmountSent[19]
      123, // encryptedAmountSent[20]
      123, // encryptedAmountSent[21]
      123, // encryptedAmountSent[22]
      123, // encryptedAmountSent[23]
      123, // encryptedAmountSent[24]
      tokenAddr,
      block.chainid,
      0, // ogBalance,
      0, // balanceNonce,
      123 //newBalanceNonce,
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
      123, // encryptedAmountSent[3]
      123, // encryptedAmountSent[4]
      123, // encryptedAmountSent[5]
      123, // encryptedAmountSent[6]
      123, // encryptedAmountSent[7]
      123, // encryptedAmountSent[8]
      123, // encryptedAmountSent[9]
      123, // encryptedAmountSent[10]
      123, // encryptedAmountSent[11]
      123, // encryptedAmountSent[12]
      123, // encryptedAmountSent[13]
      123, // encryptedAmountSent[14]
      123, // encryptedAmountSent[15]
      123, // encryptedAmountSent[16]
      123, // encryptedAmountSent[17]
      123, // encryptedAmountSent[18]
      123, // encryptedAmountSent[19]
      123, // encryptedAmountSent[20]
      123, // encryptedAmountSent[21]
      123, // encryptedAmountSent[22]
      123, // encryptedAmountSent[23]
      123, // encryptedAmountSent[24]
      tokenAddr,
      block.chainid,
      encBalance, // ogBalance,
      123, // balanceNonce,
      1234 //newBalanceNonce,
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
      123, // encryptedAmountSent[3]
      123, // encryptedAmountSent[4]
      123, // encryptedAmountSent[5]
      123, // encryptedAmountSent[6]
      123, // encryptedAmountSent[7]
      123, // encryptedAmountSent[8]
      123, // encryptedAmountSent[9]
      123, // encryptedAmountSent[10]
      123, // encryptedAmountSent[11]
      123, // encryptedAmountSent[12]
      123, // encryptedAmountSent[13]
      123, // encryptedAmountSent[14]
      123, // encryptedAmountSent[15]
      123, // encryptedAmountSent[16]
      123, // encryptedAmountSent[17]
      123, // encryptedAmountSent[18]
      123, // encryptedAmountSent[19]
      123, // encryptedAmountSent[20]
      123, // encryptedAmountSent[21]
      123, // encryptedAmountSent[22]
      123, // encryptedAmountSent[23]
      123, // encryptedAmountSent[24]
      tokenAddr,
      block.chainid,
      encBalance, // ogBalance,
      123, // balanceNonce,
      1234 //newBalanceNonce,
    ]);

    assertEq(token.balanceOf(address(this)), privateAmount);
  }
}

