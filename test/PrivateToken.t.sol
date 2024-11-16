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

  function account2() internal view returns(uint, uint) {
    uint privateKey2 = 0x20644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001;
    uint publicKey2 = wrapper.modExp(2, privateKey2, SNARK_SCALAR_FIELD);
    return (privateKey2, publicKey2);
  }

  function encryptSend(uint privateAmount) internal view returns (uint, uint) {
    (uint privateKey2, uint publicKey2) = account2();
    uint256 sendNonce = 679;
    uint256 encodedSecret = wrapper.modExp(2, privateAmount, SNARK_SCALAR_FIELD);
    uint256 ephemeralKey = wrapper.modExp(2, sendNonce, SNARK_SCALAR_FIELD);
    uint256 maskingKey = wrapper.modExp(publicKey2, sendNonce, SNARK_SCALAR_FIELD);
    uint256 encryptedAmount = wrapper.modMul(encodedSecret, maskingKey, SNARK_SCALAR_FIELD);
    return (encryptedAmount, ephemeralKey);
  }

  function burnFromSecond(uint privateAmount) internal {
    address recip = address(0x5);
    (uint privateKey2, uint publicKey2) = account2();
    uint256 newBalanceNonce = 999;
    uint256 receiveNullifier = 1212;
    uint256 finalBalance = PoseidonT3.hash([privateKey2, newBalanceNonce]);
    (uint ogBalance, uint balanceNonce) = wrapper.accounts(publicKey2);
    wrapper.verifyProof([uint(0),0], [[uint(0),0],[uint(0),0]], [uint(0),0], [
      publicKey2,
      wrapper.treeRoot(),
      privateAmount,
      uint(uint160(recip)),
      finalBalance,
      receiveNullifier,
      ogBalance,
      balanceNonce,
      newBalanceNonce,
      1 // is a burn
    ]);
    assertEq(token.balanceOf(recip), privateAmount * (10**2));
  }

  function test_Mint() public {
    token.mint(1000);
    token.approve(address(wrapper), 1000);
    assertEq(token.balanceOf(address(this)), 1000);

    uint privateKey = 0x10644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001;
    uint publicKey = wrapper.modExp(2, privateKey, SNARK_SCALAR_FIELD);
    // amount 10, 2 decimals reduced = 1000 erc20 tokens
    uint privateAmount = 10;
    wrapper.mint(privateAmount, publicKey, 111);
    assertEq(token.balanceOf(address(this)), 0);

    (uint ogBalance, uint balanceNonce) = wrapper.accounts(publicKey);
    uint256 newBalanceNonce = 678;
    uint256 receiveNullifier = 6969;
    uint256 finalBalance = PoseidonT3.hash([privateKey, newBalanceNonce]);

    (uint encryptedAmount, uint ephemeralKey) = encryptSend(privateAmount);

    // Send to second account
    wrapper.verifyProof([uint(0),0], [[uint(0),0],[uint(0),0]], [uint(0),0], [
      publicKey,
      wrapper.treeRoot(),
      encryptedAmount,
      ephemeralKey,
      finalBalance,
      receiveNullifier,
      ogBalance,
      balanceNonce,
      newBalanceNonce,
      0 // not a burn
    ]);
    (uint afterBalance, uint afterBalanceNonce) = wrapper.accounts(publicKey);

    assertEq(finalBalance, afterBalance);
    assertEq(newBalanceNonce, afterBalanceNonce);

    // burn back to account
    burnFromSecond(privateAmount);
  }

}

