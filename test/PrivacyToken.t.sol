// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import "../contracts/PrivacyToken.sol";
import {LeafAlreadyExists} from "../contracts/InternalLeanIMT.sol";
import "./MockPrivacyVerifier.sol";
import "./MockERC20.sol";
import "./MockAToken.sol";
import "./MockUserValidator.sol";

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
    // Very small max tree size to test switching to new trees
    wrapper = new PrivacyToken(address(verifier), address(0), 2);
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

    assertEq(wrapper.treeCount(), 2);
    assertEq(wrapper.sendCount(0), 2);
    assertEq(wrapper.sendCount(1), 1);
  }

  function test_ScaledMintAndBurn() public {
    bytes memory mockNotice = abi.encode(69);

    // Deploy our mock AToken that supports scaled balances.
    MockAToken aToken = new MockAToken();

    // Mint tokens into our test account.
    // For testing purposes we mint 2000 units.
    aToken.mint(2000);
    // Set the scaled total supply to 1000 so that the liquidity index is 2.
    aToken.setScaledTotalSupply(1000);
    // Approve the PrivacyToken wrapper to spend tokens on our behalf.
    aToken.approve(address(wrapper), 2000);

    // Confirm initial balance.
    assertEq(aToken.balanceOf(address(this)), 2000);

    // Setup a mint using fixed (proof) amount = 100.
    // The wrapper will call _getScaledAmount so that:
    // scaledAmount = (100 * 1000) / 2000 = 50.
    uint fixedAmount = 100;
    uint expectedScaledAmount = 50;
    uint tokenHash = 111;
    uint mintNullifier = 1001;
    uint nonceAfterMint = 1;
    uint encBalanceAfterMint = 10; // arbitrary encrypted balance
    uint myPublicKey = 555;
    uint mintHash = 2020;
    uint publicTokenAddr = uint(uint160(address(aToken)));

    PubSignals memory mintPubs = PubSignals({
      treeIndex: 0,
      publicMode: 1, // mint
      chainId: block.chainid,
      encryptedBalance: 0,
      oldBalanceNonce: 0,
      newBalanceNonce: nonceAfterMint,
      receiveNullifier: mintNullifier,
      tokenHash: tokenHash,
      newBalance: encBalanceAfterMint,
      myPublicKey: myPublicKey,
      treeRoot: 0, // will update below
      hash: mintHash,
      publicTokenAddr: publicTokenAddr,
      publicAddress: 0,
      publicAmount: expectedScaledAmount
    });

    // To pass the tree root check, update treeRoot.
    mintPubs.treeRoot = wrapper.treeRoot(mintPubs.treeIndex);

    // Execute the mint. The wrapper will call aToken.transferFrom(...)
    // with scaled amount = 50.
    wrapper.verifyProof(encodeProof(mintPubs), mockNotice);

    // Check that our account’s balance has decreased by 50.
    assertEq(aToken.balanceOf(address(this)), 2000 - fixedAmount);
    // And that the wrapper now holds 50 tokens.
    assertEq(aToken.balanceOf(address(wrapper)), fixedAmount);

    wrapper.verifyProof(encodeProof(PubSignals({
      treeIndex: 0,
      publicMode: 0, // update transaction (send) that updates account state
      chainId: block.chainid,
      encryptedBalance: 0,
      oldBalanceNonce: 0,                    // current nonce is 0
      newBalanceNonce: nonceAfterMint,         // update nonce to 1
      receiveNullifier: mintNullifier + 5,       // new unique nullifier
      tokenHash: tokenHash,
      newBalance: encBalanceAfterMint,          // update balance to the same value
      myPublicKey: myPublicKey,
      treeRoot: wrapper.treeRoot(mintPubs.treeIndex),
      hash: mintHash + 5,
      publicTokenAddr: 0,                      // no token transfer here
      publicAddress: 0,
      publicAmount: 0
    })), mockNotice);

    // Now perform a burn back to public.
    // The burn will again use a fixed amount of 100, which converts to 50.
    PubSignals memory burnPubs = PubSignals({
      treeIndex: 0,
      publicMode: 2, // burn
      chainId: block.chainid,
      encryptedBalance: encBalanceAfterMint,
      oldBalanceNonce: nonceAfterMint,
      newBalanceNonce: nonceAfterMint, // for simplicity
      receiveNullifier: mintNullifier + 10,
      tokenHash: tokenHash,
      newBalance: encBalanceAfterMint + 1,
      myPublicKey: myPublicKey,
      treeRoot: wrapper.treeRoot(mintPubs.treeIndex),
      hash: mintHash + 10,
      publicTokenAddr: publicTokenAddr,
      publicAddress: uint(uint160(address(this))),
      publicAmount: expectedScaledAmount
    });

    // Execute the burn. The wrapper will call aToken.transfer(...)
    // transferring back the scaled amount of 50.
    wrapper.verifyProof(encodeProof(burnPubs), mockNotice);

    // At the end, our account’s balance should be back to 2000
    // and the wrapper’s balance should be 0.
    assertEq(aToken.balanceOf(address(this)), 2000);
    assertEq(aToken.balanceOf(address(wrapper)), 0);
  }

  function test_UserValidation() public {
    bytes memory mockNotice = abi.encode(69);
    MockUserValidator validator = new MockUserValidator();
    PrivacyToken vWrapper = new PrivacyToken(address(verifier), address(validator), 2**32);

    uint privateAmount = 10;
    uint tokenHash = 345;
    uint mintNullifier = 234;
    uint nonceAfterMint = 123;
    uint encBalanceAfterMint = 456;
    uint myPublicKey = 567;
    uint mintHash = 789;
    uint publicTokenAddr = uint(uint160(address(token)));

    token.mint(privateAmount);
    token.approve(address(vWrapper), privateAmount + 1);
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
      privateAmount // publicAmount
    );

    // Mock validator defaults to false
    try vWrapper.verifyProof(encodeProof(mintPubs), mockNotice) {
      // This is expected to fail
      revert TestError();
    } catch (bytes memory reason) {
      assertEq(PrivacyToken__InvalidUser.selector, firstFourBytes(reason));
    }

    // Allow validation success
    validator.setRetval(true);
    vWrapper.verifyProof(encodeProof(mintPubs), mockNotice);

    // First invocation is rolled back, only the success goes through
    assertEq(validator.counter(), 1);
  }
}


