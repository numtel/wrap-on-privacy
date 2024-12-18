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
  MockVerifier public verifier;
  MockMintVerifier public mintVerifier;

  error TestError();

  function setUp() public {
    token = new MockERC20();
    verifier = new MockVerifier();
    mintVerifier = new MockMintVerifier();
    wrapper = new PrivateToken(address(token), 2, address(verifier), address(mintVerifier));
  }

  function account2() internal view returns(uint, uint) {
    uint privateKey2 = 0x20644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001;
    uint publicKey2 = modExp(2, privateKey2, SNARK_SCALAR_FIELD);
    return (privateKey2, publicKey2);
  }

  // Modular exponentiation using the precompiled contract at address 0x05
  function modExp(
      uint256 base,
      uint256 exponent,
      uint256 modulus
  ) public view returns (uint256 result) {
      assembly {
          let pointer := mload(0x40) // Free memory pointer
          mstore(pointer, 0x20)     // Base length (32 bytes)
          mstore(add(pointer, 0x20), 0x20) // Exponent length (32 bytes)
          mstore(add(pointer, 0x40), 0x20) // Modulus length (32 bytes)
          mstore(add(pointer, 0x60), base) // Base
          mstore(add(pointer, 0x80), exponent) // Exponent
          mstore(add(pointer, 0xa0), modulus) // Modulus
          if iszero(staticcall(not(0), 0x05, pointer, 0xc0, pointer, 0x20)) {
              revert(0, 0)
          }
          result := mload(pointer)
      }
  }

  // Modular multiplication to prevent overflow
  function modMul(
      uint256 a,
      uint256 b,
      uint256 modulus
  ) public pure returns (uint256 result) {
      assembly {
          let mm := mulmod(a, b, modulus)
          result := mm
      }
  }

  function encryptSend(uint privateAmount, uint sendNonce) internal view returns (uint, uint) {
    (uint privateKey2, uint publicKey2) = account2();
    uint256 encodedSecret = modExp(2, privateAmount, SNARK_SCALAR_FIELD);
    uint256 ephemeralKey = modExp(2, sendNonce, SNARK_SCALAR_FIELD);
    uint256 maskingKey = modExp(publicKey2, sendNonce, SNARK_SCALAR_FIELD);
    uint256 encryptedAmount = modMul(encodedSecret, maskingKey, SNARK_SCALAR_FIELD);
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

  function elgamalEncrypt(uint message, uint nonce, uint publicKey) internal view returns (uint ephemeralKey, uint encryptedMessage) {
    uint256 encodedSecret = modExp(2, message, SNARK_SCALAR_FIELD);
    ephemeralKey = modExp(2, nonce, SNARK_SCALAR_FIELD);
    uint256 maskingKey = modExp(publicKey, nonce, SNARK_SCALAR_FIELD);
    encryptedMessage = modMul(encodedSecret, maskingKey, SNARK_SCALAR_FIELD);
  }

  function performMint(uint privateAmount, uint sendNonce, uint publicKey) internal {
    (uint ephemeralKey, uint encryptedAmount) = elgamalEncrypt(privateAmount, sendNonce, publicKey);

    wrapper.mint([uint(0),0], [[uint(0),0],[uint(0),0]], [uint(0),0], [
      ephemeralKey,
      encryptedAmount,
      privateAmount
    ]);

    // Accept the incoming tx with a zero-value send
    (uint sendEphemeralKey, uint sendEncryptedAmount) = elgamalEncrypt(0, sendNonce + 1, publicKey);
    wrapper.verifyProof([uint(0),0], [[uint(0),0],[uint(0),0]], [uint(0),0], [
      publicKey,
      wrapper.treeRoot(),
      sendEncryptedAmount,
      sendEphemeralKey,
      privateAmount,
      123123, //receiveNullifier,
      0, //ogBalance,
      0, //balanceNonce,
      123, //newBalanceNonce,
      0 // not a burn
    ]);
  }

  function test_Mint() public {
    token.mint(1000);
    token.approve(address(wrapper), 1000);
    assertEq(token.balanceOf(address(this)), 1000);

    uint privateKey = 0x10644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001;
    uint publicKey = modExp(2, privateKey, SNARK_SCALAR_FIELD);
    // amount 10, 2 decimals reduced = 1000 erc20 tokens
    uint privateAmount = 10;

    uint256 newBalanceNonce = 678;
    uint256 receiveNullifier = 6969;
    uint256 finalBalance = PoseidonT3.hash([privateKey, newBalanceNonce]);

    (uint encryptedAmount, uint ephemeralKey) = encryptSend(privateAmount, 679);
    performMint(privateAmount, 12345, publicKey);
    assertEq(token.balanceOf(address(this)), 0);

    (uint ogBalance, uint balanceNonce) = wrapper.accounts(publicKey);

    // Cannot provide a fake balance at init
    try wrapper.verifyProof([uint(0),0], [[uint(0),0],[uint(0),0]], [uint(0),0], [
      publicKey,
      wrapper.treeRoot(),
      encryptedAmount,
      ephemeralKey,
      finalBalance,
      receiveNullifier,
      100,
      balanceNonce,
      newBalanceNonce,
      0 // not a burn
    ]) {
      revert TestError();
    } catch {
      // We want an error since the balance has been manipulated
    }

    // Cannot provide a fake balance nonce
    try wrapper.verifyProof([uint(0),0], [[uint(0),0],[uint(0),0]], [uint(0),0], [
      publicKey,
      wrapper.treeRoot(),
      encryptedAmount,
      ephemeralKey,
      finalBalance,
      receiveNullifier,
      ogBalance,
      100,
      newBalanceNonce,
      0 // not a burn
    ]) {
      revert TestError();
    } catch {
      // We want an error since the balance nonce has been manipulated
    }

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

