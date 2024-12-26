//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {InternalLeanIMT, LeanIMTData, SNARK_SCALAR_FIELD} from "./InternalLeanIMT.sol";
import {PoseidonT3} from "./PoseidonT3.sol";

import "./IPrivateToken.sol";

contract PrivateToken is IPrivateToken {
  using InternalLeanIMT for LeanIMTData;

  uint8 public reduceDecimals;
  IERC20 public wrappedToken;
  IVerifier public verifier;
  IMintVerifier public mintVerifier;

  LeanIMTData sendTree;
  bytes[] public encryptedSends;
  // keyed by publicKey
  mapping(uint256 => PrivateAccount) public accounts;
  // keyed by receiveNullifier
  mapping(uint256 => bool) public receivedHashes;

  constructor(address tokenToWrap, uint8 _reduceDecimals, address _verifier, address _mintVerifier) {
    wrappedToken = IERC20(tokenToWrap);
    reduceDecimals = _reduceDecimals;
    verifier = IVerifier(_verifier);
    mintVerifier = IMintVerifier(_mintVerifier);

    // Populate the tree with a single entry so proofs can be generated
    uint256 receiveTxHash = PoseidonT3.hash([uint256(1), 1]);
    encryptedSends.push(abi.encodePacked(uint(1)));
    sendTree._insert(receiveTxHash);
  }

  function hashMulti(uint[nO] memory input) internal pure returns (uint256) {
    uint hash = PoseidonT3.hash([input[0], input[1]]);
    for(uint i = 2; i<nO; i++) {
      hash = PoseidonT3.hash([hash, input[i]]);
    }
    return hash;
  }

  function sendCount() external view returns (uint256) {
    return encryptedSends.length;
  }

  function treeRoot() external view returns (uint256) {
    return sendTree._root();
  }

  function mint(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[nPubMint] calldata _pubSignals) external {
    if(!mintVerifier.verifyProof(_pA, _pB, _pC, _pubSignals)) {
      revert PrivateToken__InvalidProof();
    }

    uint256[nO] memory encryptedSent;
    for(uint i = 0; i<nO; i++) {
      encryptedSent[i] = _pubSignals[i];
    }

    uint256 receiveTxHash = hashMulti(encryptedSent);
    encryptedSends.push(abi.encodePacked(encryptedSent));
    sendTree._insert(receiveTxHash);

    wrappedToken.transferFrom(msg.sender, address(this), _pubSignals[nPubMint-1] * (10 ** reduceDecimals));
  }

  function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[nPub] calldata _pubSignals) external {
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
    uint encBalance = accounts[pubs.publicKey].encryptedBalance;
    uint curNonce = accounts[pubs.publicKey].nonce;
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
    accounts[pubs.publicKey].encryptedBalance = pubs.finalBalance;
    accounts[pubs.publicKey].nonce = pubs.newBalanceNonce;

    // Submit possible send to tree
    // TODO support recent roots to like Semaphore
    if(sendTree._root() != pubs.treeRoot) {
      revert PrivateToken__InvalidTreeRoot();
    }
    if(pubs.encryptedAmountSent[0] == 1) {
      // This is a burn
      // get recip address (recipPubKey) from the sendEphemeralKey
      wrappedToken.transfer(address(uint160(pubs.encryptedAmountSent[2])), pubs.encryptedAmountSent[1] * (10 ** reduceDecimals));
    } else {
      // This might be a send
      uint256 receiveTxHash = hashMulti(pubs.encryptedAmountSent);
      encryptedSends.push(abi.encodePacked(pubs.encryptedAmountSent));
      sendTree._insert(receiveTxHash);
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
