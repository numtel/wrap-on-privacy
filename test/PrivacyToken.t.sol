// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import "../contracts/PrivacyToken.sol";
import {LeafAlreadyExists} from "../contracts/InternalLeanIMT.sol";
import "./MockPrivacyVerifier.sol";
import "./MockERC20.sol";

contract PrivacyTokenTest is Test {
  PrivacyToken public wrapper;
  MockERC20 public token;
  uint public tokenAddr;
  MockPrivacyVerifier public verifier;

  error TestError();

  function setUp() public {
    token = new MockERC20();
    tokenAddr = uint256(uint160(address(token)));
    verifier = new MockPrivacyVerifier();
    wrapper = new PrivacyToken(address(verifier));
  }

  function encodeProof(PubSignals memory pubs) internal pure returns(bytes memory out) {
    // Split to avoid stack-too-deep
    out = abi.encodePacked(
      // 8 zeros as the proof, mock verifier doesn't check
      abi.encode(0, 0, 0, 0, 0, 0, 0, 0),
      abi.encode(
        pubs.receiveNullifier,
        pubs.tokenHash,
        pubs.newBalance,
        pubs.myPublicKey,
        pubs.treeRoot,
        pubs.hash,
        pubs.publicTokenAddr,
        pubs.publicAddress,
        pubs.publicAmount
      ),
      abi.encode(
        pubs.treeIndex,
        pubs.publicMode,
        pubs.chainId,
        pubs.encryptedBalance,
        pubs.oldBalanceNonce,
        pubs.newBalanceNonce
      )
    );
  }
  
  function firstFourBytes(bytes memory reason) internal pure returns (bytes4) {
    return bytes4(reason[0]) | (bytes4(reason[1]) >> 8) | (bytes4(reason[2]) >> 16) | (bytes4(reason[3]) >> 24);
  }

  function test_XMint() public {
    bytes memory mockNotice = abi.encode(69);

    uint privateAmount = 10;
    uint tokenHash = 345;
    uint mintNullifier = 234;
    uint nonceAfterMint = 123;
    uint encBalanceAfterMint = 456;
    uint myPublicKey = 567;
    uint mintHash = 789;
    uint publicTokenAddr = uint(uint160(address(token)));

    token.mint(privateAmount);
    token.approve(address(wrapper), privateAmount + 1);
    assertEq(token.balanceOf(address(this)), privateAmount);

    // Cannot mint more than balance
    PubSignals memory mintPubs = PubSignals(
      uint(0), // treeIndex
      1, // publicMode mint
      block.chainid,
      0, // encryptedBalance,
      0, // oldBalanceNonce,
      nonceAfterMint, // newBalanceNonce,
      mintNullifier, // receiveNullifier,
      tokenHash,
      encBalanceAfterMint, // newBalance,
      myPublicKey,
      0, // treeRoot,
      mintHash, // hash
      publicTokenAddr,
      0, // publicAddr
      privateAmount + 1 // publicAmount causes fail!
    );

    try wrapper.verifyProof(encodeProof(mintPubs), mockNotice) {
      // This is expected to fail
      revert TestError();
    } catch (bytes memory reason) {
      assertEq(IERC20Errors.ERC20InsufficientBalance.selector, firstFourBytes(reason));
    }

    // Now, perform a successful mint
    mintPubs.publicAmount = privateAmount;
    wrapper.verifyProof(encodeProof(mintPubs), mockNotice);

    // Ensure that it can't be replayed
    token.mint(privateAmount);
    token.approve(address(wrapper), privateAmount + 1);

    // No modification
    try wrapper.verifyProof(encodeProof(mintPubs), mockNotice) {
      // This is expected to fail
      revert TestError();
    } catch (bytes memory reason) {
      assertEq(PrivacyToken__DuplicateNullifier.selector, firstFourBytes(reason));
    }

    // Different nullifier
    mintPubs.receiveNullifier = mintNullifier + 1;
    try wrapper.verifyProof(encodeProof(mintPubs), mockNotice) {
      // This is expected to fail
      revert TestError();
    } catch (bytes memory reason) {
      assertEq(PrivacyToken__InvalidTreeRoot.selector, firstFourBytes(reason));
    }

    // Root is updated
    mintPubs.treeRoot = wrapper.treeRoot(mintPubs.treeIndex);
    try wrapper.verifyProof(encodeProof(mintPubs), mockNotice) {
      // This is expected to fail
      revert TestError();
    } catch (bytes memory reason) {
      assertEq(LeafAlreadyExists.selector, firstFourBytes(reason));
    }

    // Hash is changed
    mintPubs.hash = mintHash + 1;
    // And it works now
    wrapper.verifyProof(encodeProof(mintPubs), mockNotice);

    // Accept this 2nd incoming tx
    mintPubs.publicMode = 0;
    mintPubs.publicTokenAddr = 0;
    mintPubs.publicAmount = 0;
    mintPubs.receiveNullifier = mintNullifier + 2;
    mintPubs.treeRoot = wrapper.treeRoot(mintPubs.treeIndex);
    mintPubs.hash = mintHash + 2;
    wrapper.verifyProof(encodeProof(mintPubs), mockNotice);

    // Cannot accept the same incoming tx twice
    try wrapper.verifyProof(encodeProof(mintPubs), mockNotice) {
      // This is expected to fail
      revert TestError();
    } catch (bytes memory reason) {
      assertEq(PrivacyToken__DuplicateNullifier.selector, firstFourBytes(reason));
    }

		// Burn back to public
    PubSignals memory burnPubs = PubSignals(
      uint(0), // treeIndex
      2, // publicMode burn
      block.chainid,
      encBalanceAfterMint, // encryptedBalance,
      nonceAfterMint, // oldBalanceNonce,
      nonceAfterMint, // newBalanceNonce,
      mintNullifier + 3, // receiveNullifier,
      tokenHash,
      encBalanceAfterMint + 1, // newBalance,
      myPublicKey,
      wrapper.treeRoot(mintPubs.treeIndex), // treeRoot,
      mintHash + 3, // hash
      publicTokenAddr,
      uint(uint160(address(this))), // publicAddr
      privateAmount // publicAmount
    );
    wrapper.verifyProof(encodeProof(burnPubs), mockNotice);
    assertEq(token.balanceOf(address(this)), privateAmount);
  }
}


