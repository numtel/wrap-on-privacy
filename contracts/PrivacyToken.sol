//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {InternalLeanIMT, LeanIMTData} from "./InternalLeanIMT.sol";
import {PoseidonT3} from "./PoseidonT3.sol";
import "./IScaledERC20.sol";

interface IVerifier {
  function verifyProof(
    uint[2] calldata _pA,
    uint[2][2] calldata _pB,
    uint[2] calldata _pC,
    uint[15] calldata _pubSignals
  ) external view returns (bool);
}

struct PrivateAccount {
  uint256 encryptedBalance;
  uint256 nonce;
}

struct PubSignals {
  uint256 treeIndex;
  uint256 publicMode; // 1 = mint, 2 = burn
  uint256 chainId;
  uint256 encryptedBalance;
  uint256 oldBalanceNonce;
  uint256 newBalanceNonce;

  uint256 receiveNullifier;
  uint256 tokenHash;
  uint256 newBalance;
  uint256 myPublicKey;
  uint256 treeRoot;
  uint256 hash;
  uint256 publicTokenAddr;
  uint256 publicAddress;
  uint256 publicAmount;
}

error PrivacyToken__InvalidChainId();
error PrivacyToken__InvalidProof();
error PrivacyToken__DuplicateNullifier();
error PrivacyToken__InvalidBalance();
error PrivacyToken__InvalidBalanceNonce();
error PrivacyToken__InvalidTreeRoot();
error PrivacyToken__InvalidAmount();
error PrivacyToken__InvalidNewBalance();
error PrivacyToken__InvalidNewBalanceNonce();

contract PrivacyToken {
  using InternalLeanIMT for LeanIMTData;

  IVerifier public verifier;

  address[] public liveTokens;
  mapping(address => uint256) public tokenIsLive;

  uint256 treeCount;
  // keyed by tree index
  mapping(uint256 => LeanIMTData) sendTree;
  mapping(uint256 => bytes[]) public encryptedSends;
  mapping(uint256 => uint256[]) public sendHashes;
  mapping(uint256 => uint256[]) public sendTimes;
  mapping(uint256 => address[]) public sendAccounts;
  // keyed by tokenHash, publicKey
  mapping(uint256 => mapping(uint256 => PrivateAccount)) public accounts;
  // keyed by receiveNullifier
  mapping(uint256 => bool) public receivedHashes;

  constructor(address _verifier) {
    verifier = IVerifier(_verifier);
  }

  function sendCount(uint256 treeIndex) external view returns (uint256) {
    return encryptedSends[treeIndex].length;
  }

  function tokenCount() external view returns (uint256) {
    return liveTokens.length;
  }

  function treeRoot(uint256 treeIndex) external view returns (uint256) {
    return sendTree[treeIndex]._root();
  }

  function _verifyProof(bytes memory data) internal view returns (PubSignals memory) {
    require(data.length >= 23 * 32, "Insufficient bytes length");

    uint256[23] memory result = abi.decode(data, (uint256[23]));

    uint[2] memory _pA = [result[0], result[1]];
    uint[2][2] memory _pB = [[result[2], result[3]], [result[4], result[5]]];
    uint[2] memory _pC = [result[6], result[7]];
    uint[15] memory _pubSignals = [
      result[8], result[9], result[10], result[11], result[12], result[13],
      result[14], result[15], result[16],
      result[17], result[18], result[19], result[20], result[21], result[22]
    ];
    if(!verifier.verifyProof(_pA, _pB, _pC, _pubSignals)) {
      revert PrivacyToken__InvalidProof();
    }
    return PubSignals(
      result[17], result[18], result[19], result[20], result[21], result[22],
      result[8], result[9], result[10], result[11], result[12], result[13],
      result[14], result[15], result[16]
    );
  }

  function _isScaledToken(address token) internal view returns (bool) {
    try IScaledERC20(token).scaledTotalSupply() returns (uint256) {
      return true;
    } catch {
      return false;
    }
  }

  function _getScaledAmount(address token, uint256 fixedAmount) internal view returns (uint256) {
    uint256 totalSupply = IERC20(token).totalSupply();
    uint256 scaledSupply = IScaledERC20(token).scaledTotalSupply();
    if (totalSupply == 0 || scaledSupply == 0) {
      return fixedAmount;
    }
    return (fixedAmount * totalSupply) / scaledSupply;
  }

  function verifyProof(bytes memory proofData, bytes memory noticeData) external {
    PubSignals memory pubs = _verifyProof(proofData);

    // Ensure this receive hasn't happened before
    if(receivedHashes[pubs.receiveNullifier] == true) {
      revert PrivacyToken__DuplicateNullifier();
    }

    if(pubs.chainId != block.chainid) {
      revert PrivacyToken__InvalidChainId();
    }

    // Set this nullifier
    receivedHashes[pubs.receiveNullifier] = true;

    // Update the user's balance if it's not a mint
    if(pubs.publicMode != 1) {
      uint encBalance = accounts[pubs.tokenHash][pubs.myPublicKey].encryptedBalance;
      uint curNonce = accounts[pubs.tokenHash][pubs.myPublicKey].nonce;

      if(encBalance != pubs.encryptedBalance) {
        revert PrivacyToken__InvalidBalance();
      }
      if(curNonce != pubs.oldBalanceNonce) {
        revert PrivacyToken__InvalidBalanceNonce();
      }
      if(pubs.newBalance == 0) {
        revert PrivacyToken__InvalidNewBalance();
      }
      if(pubs.newBalanceNonce == 0) {
        revert PrivacyToken__InvalidNewBalanceNonce();
      }

      accounts[pubs.tokenHash][pubs.myPublicKey].encryptedBalance = pubs.newBalance;
      accounts[pubs.tokenHash][pubs.myPublicKey].nonce = pubs.newBalanceNonce;
    }

    // Submit possible send to tree
    // TODO support recent roots to like Semaphore
    if(sendTree[pubs.treeIndex]._root() != pubs.treeRoot) {
      revert PrivacyToken__InvalidTreeRoot();
    }
    
    address tokenAddr = address(uint160(pubs.publicTokenAddr));

    if (pubs.publicMode == 2) {
      // Burn: send tokens to the recipient.
      // When the token is scaled, we transfer the scaled amount.
      uint256 amount;
      if (_isScaledToken(tokenAddr)) {
        // The proof deals with the fixed amounts
        amount = _getScaledAmount(tokenAddr, pubs.publicAmount);
        IScaledERC20(tokenAddr).transfer(address(uint160(pubs.publicAddress)), amount);
      } else {
        amount = pubs.publicAmount;
        IERC20(tokenAddr).transfer(address(uint160(pubs.publicAddress)), amount);
      }
    } else {
      if (pubs.publicMode == 1) {
        // Mint: pull tokens from the sender.
        if (tokenIsLive[tokenAddr] == 0) {
          tokenIsLive[tokenAddr] = block.timestamp;
          liveTokens.push(tokenAddr);
        }
        uint256 amount;
        if (_isScaledToken(tokenAddr)) {
          // The proof deals with the fixed amounts
          amount = _getScaledAmount(tokenAddr, pubs.publicAmount);
          IScaledERC20(tokenAddr).transferFrom(msg.sender, address(this), amount);
        } else {
          amount = pubs.publicAmount;
          IERC20(tokenAddr).transferFrom(msg.sender, address(this), amount);
        }
      }

      // This might be a send
      // TODO needs to go to active tree index, not the one specified!
      encryptedSends[pubs.treeIndex].push(noticeData);
      sendTimes[pubs.treeIndex].push(block.timestamp);
      sendAccounts[pubs.treeIndex].push(msg.sender);
      sendHashes[pubs.treeIndex].push(pubs.hash);
      sendTree[pubs.treeIndex]._insert(pubs.hash);
    }

  }
}

