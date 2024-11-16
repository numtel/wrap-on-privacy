//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {InternalLeanIMT, LeanIMTData} from "./InternalLeanIMT.sol";
import {PoseidonT3} from "./PoseidonT3.sol";

import "./IPrivateToken.sol";

contract PrivateToken is IPrivateToken {
  using InternalLeanIMT for LeanIMTData;

  uint256 public constant MAX_SEND = 524288; // 2**19

  uint8 public reduceDecimals;
  IERC20 public wrappedToken;
  IVerifier public verifier;

  LeanIMTData sendTree;
  PrivateSend[] public encryptedSends;
  // keyed by publicKey
  mapping(uint256 => PrivateAccount) public accounts;
  // keyed by receiveNullifier
  mapping(uint256 => bool) public receivedHashes;

  constructor(address tokenToWrap, uint8 _reduceDecimals, address _verifier) {
    wrappedToken = IERC20(tokenToWrap);
    reduceDecimals = _reduceDecimals;
    verifier = IVerifier(_verifier);
  }

  function sendCount() external view returns (uint256) {
    return encryptedSends.length;
  }

  function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[9] calldata _pubSignals) external {
    if(!verifier.verifyProof(_pA, _pB, _pC, _pubSignals)) {
      revert PrivateToken__InvalidProof();
    }

    // Ensure this receive hasn't happened before
    PubSignals memory pubs = parsePubSignals(_pubSignals);
    if(receivedHashes[pubs.receiveNullifier] == true) {
      revert PrivateToken__DuplicateNullifier();
    }
    // Set this nullifier
    receivedHashes[pubs.receiveNullifier] = true;

    // Update the user's balance
    if(accounts[pubs.publicKey].encryptedBalance != pubs.encryptedBalance) {
      revert PrivateToken__InvalidBalance();
    }
    if(accounts[pubs.publicKey].nonce != pubs.balanceNonce) {
      revert PrivateToken__InvalidBalanceNonce();
    }
    accounts[pubs.publicKey].encryptedBalance = pubs.finalBalance;
    accounts[pubs.publicKey].nonce = pubs.newBalanceNonce;

    // Submit possible send to tree
    // TODO support recent roots to like Semaphore
    if(sendTree._root() != pubs.treeRoot) {
      revert PrivateToken__InvalidTreeRoot();
    }
    if(pubs.encryptedAmountSent <= MAX_SEND) {
      // This is a burn
      // TODO get recip address (recipPubKey) from the sendEphemeralKey
    } else {
      // This might be a send
      uint256 receiveTxHash = PoseidonT3.hash([pubs.encryptedAmountSent, pubs.sendEphemeralKey]);
      encryptedSends.push(PrivateSend(pubs.encryptedAmountSent, pubs.sendEphemeralKey));
      sendTree._insert(receiveTxHash);
    }

  }

  function parsePubSignals(uint[9] calldata _pubSignals) internal pure returns (PubSignals memory) {
    return PubSignals(
      _pubSignals[0],
      _pubSignals[1],
      _pubSignals[2],
      _pubSignals[3],
      _pubSignals[4],
      _pubSignals[5],
      _pubSignals[6],
      _pubSignals[7],
      _pubSignals[8]
    );
  }

}

interface IVerifier {
  function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[9] calldata _pubSignals) external view returns (bool);
}
