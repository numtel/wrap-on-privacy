//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {InternalLeanIMT, LeanIMTData} from "./InternalLeanIMT.sol";
import {PoseidonT3} from "./PoseidonT3.sol";

import "./IPrivateToken.sol";

contract PrivateToken is IPrivateToken {
  using InternalLeanIMT for LeanIMTData;

  IVerifier public verifier;
  IMintVerifier public mintVerifier;

  // TODO support multiple trees per token
  mapping(uint256 => LeanIMTData) sendTree;
  mapping(uint256 => bytes[]) public encryptedSends;
  mapping(uint256 => uint256[]) public sendTimes;
  // keyed by publicKey
  mapping(uint256 => mapping(uint256 => PrivateAccount)) public accounts;
  // keyed by receiveNullifier
  mapping(uint256 => mapping(uint256 => bool)) public receivedHashes;

  constructor(address _verifier, address _mintVerifier) {
    verifier = IVerifier(_verifier);
    mintVerifier = IMintVerifier(_mintVerifier);
  }

  function hashMulti(uint[nO] memory input) internal pure returns (uint256) {
    uint hash = PoseidonT3.hash([input[0], input[1]]);
    for(uint i = 2; i<nO; i++) {
      hash = PoseidonT3.hash([hash, input[i]]);
    }
    return hash;
  }

  function sendCount(address token) external view returns (uint256) {
    return encryptedSends[uint256(uint160(token))].length;
  }

  function treeRoot(address token) external view returns (uint256) {
    return sendTree[uint256(uint160(token))]._root();
  }

  function mint(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[nPubMint] calldata _pubSignals) external {
    if(!mintVerifier.verifyProof(_pA, _pB, _pC, _pubSignals)) {
      revert PrivateToken__InvalidProof();
    }

    if(_pubSignals[nPubMint-1] != block.chainid) {
      revert PrivateToken__InvalidChainId();
    }

    address tokenAddr = address(uint160(_pubSignals[nPubMint-2]));

    uint256[nO] memory encryptedSent;
    for(uint i = 0; i<nO; i++) {
      encryptedSent[i] = _pubSignals[i];
    }

    uint256 receiveTxHash = hashMulti(encryptedSent);
    encryptedSends[_pubSignals[nPubMint-2]].push(abi.encodePacked(encryptedSent));
    sendTimes[_pubSignals[nPubMint-2]].push(block.timestamp);
    sendTree[_pubSignals[nPubMint-2]]._insert(receiveTxHash);

    IERC20(tokenAddr).transferFrom(msg.sender, address(this), _pubSignals[nPubMint-3]);
  }

  function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[nPub] calldata _pubSignals) external {
    if(!verifier.verifyProof(_pA, _pB, _pC, _pubSignals)) {
      revert PrivateToken__InvalidProof();
    }

    // Ensure this receive hasn't happened before
    PubSignals memory pubs = parsePubSignals(_pubSignals);
    if(receivedHashes[pubs.tokenAddr][pubs.receiveNullifier] == true) {
      revert PrivateToken__DuplicateNullifier();
    }

    if(pubs.chainId != block.chainid) {
      revert PrivateToken__InvalidChainId();
    }

    address tokenAddr = address(uint160(pubs.tokenAddr));
    // Set this nullifier
    receivedHashes[pubs.tokenAddr][pubs.receiveNullifier] = true;

    // Update the user's balance
    uint encBalance = accounts[pubs.tokenAddr][pubs.publicKey].encryptedBalance;
    uint curNonce = accounts[pubs.tokenAddr][pubs.publicKey].nonce;
    if(encBalance != pubs.encryptedBalance) {
      revert PrivateToken__InvalidBalance();
    }
    if(curNonce != pubs.balanceNonce) {
      revert PrivateToken__InvalidBalanceNonce();
    }
    if(pubs.finalBalance == 0) {
      revert PrivateToken__InvalidNewBalance();
    }
    if(pubs.newBalanceNonce == 0) {
      revert PrivateToken__InvalidNewBalanceNonce();
    }
    accounts[pubs.tokenAddr][pubs.publicKey].encryptedBalance = pubs.finalBalance;
    accounts[pubs.tokenAddr][pubs.publicKey].nonce = pubs.newBalanceNonce;

    // Submit possible send to tree
    // TODO support recent roots to like Semaphore
    if(sendTree[pubs.tokenAddr]._root() != pubs.treeRoot) {
      revert PrivateToken__InvalidTreeRoot();
    }
    if(pubs.encryptedAmountSent[0] == 1) {
      // This is a burn
      // get recip address (recipPubKey) from the sendEphemeralKey
      IERC20(tokenAddr).transfer(address(uint160(pubs.encryptedAmountSent[2])), pubs.encryptedAmountSent[1]);
    } else {
      // This might be a send
      uint256 receiveTxHash = hashMulti(pubs.encryptedAmountSent);
      encryptedSends[pubs.tokenAddr].push(abi.encodePacked(pubs.encryptedAmountSent));
      sendTimes[pubs.tokenAddr].push(block.timestamp);
      sendTree[pubs.tokenAddr]._insert(receiveTxHash);
    }

  }

  function parsePubSignals(uint[nPub] calldata _pubSignals) internal pure returns (PubSignals memory) {
    uint256[nO] memory encryptedSent;
    for(uint i = 0; i<nO; i++) {
      encryptedSent[i] = _pubSignals[i+4];
    }
    return PubSignals(
      _pubSignals[0],
      _pubSignals[1],
      _pubSignals[2],
      _pubSignals[3],
      encryptedSent,
      _pubSignals[nPub-5],
      _pubSignals[nPub-4],
      _pubSignals[nPub-3],
      _pubSignals[nPub-2],
      _pubSignals[nPub-1]
    );
  }

}

interface IVerifier {
  function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[nPub] calldata _pubSignals) external view returns (bool);
}

interface IMintVerifier {
  function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[nPubMint] calldata _pubSignals) external view returns (bool);
}
