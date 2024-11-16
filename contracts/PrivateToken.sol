//SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import {InternalLeanIMT, LeanIMTData} from "./InternalLeanIMT.sol";

import "./IPrivateToken.sol";

contract PrivateToken is IPrivateToken {
  using InternalLeanIMT for LeanIMTData;

  uint8 public reduceDecimals;
  IERC20 public wrappedToken;
  IVerifier public verifier;

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

    uint publicKey = _pubSignals[0];
    uint treeRoot = _pubSignals[1];
    uint encryptedAmountSent = _pubSignals[2];
    uint sendEphemeralKey = _pubSignals[3];
    uint finalBalance = _pubSignals[4];
    uint receiveNullifier = _pubSignals[5];
    uint encryptedBalance = _pubSignals[6];
    uint
    if(receivedHashes[_pubSignals
  }

  function parsePubSignals(uint[9] calldata _pubSignals) internal view returns (PubSignals) {
    return PubSignals(
      _pubSignals[0],
      _pubSignals[1],
      _pubSignals[2],
      _pubSignals[3],
      _pubSignals[4],
      _pubSignals[5],
      _pubSignals[6],
      _pubSignals[7],
      _pubSignals[8],
      _pubSignals[9]
    );
  }

}

interface IVerifier {
  function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[9] calldata _pubSignals) external view returns (bool);
}
