//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {InternalLeanIMT, LeanIMTData, SNARK_SCALAR_FIELD} from "./InternalLeanIMT.sol";
import {PoseidonT3} from "./PoseidonT3.sol";

import "./IPrivateToken.sol";

contract PrivateToken is IPrivateToken {
  using InternalLeanIMT for LeanIMTData;

  // For reasonable decoding times
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

  function treeRoot() external view returns (uint256) {
    return sendTree._root();
  }

  function mint(uint256 amount, uint256 recipPubKey, uint256 nonce) external {
    if(amount > MAX_SEND) {
      revert PrivateToken__InvalidAmount();
    }
    // ElGamal encrypt the new funds
    uint256 encodedSecret = modExp(2, amount, SNARK_SCALAR_FIELD);
    uint256 ephemeralKey = modExp(2, nonce, SNARK_SCALAR_FIELD);
    uint256 maskingKey = modExp(recipPubKey, nonce, SNARK_SCALAR_FIELD);
    uint256 encryptedAmount = modMul(encodedSecret, maskingKey, SNARK_SCALAR_FIELD);

    uint256 receiveTxHash = PoseidonT3.hash([encryptedAmount, ephemeralKey]);
    encryptedSends.push(PrivateSend(encryptedAmount, ephemeralKey));
    sendTree._insert(receiveTxHash);

    wrappedToken.transferFrom(msg.sender, address(this), amount * (10 ** reduceDecimals));
  }

  function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[10] calldata _pubSignals) external {
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
    if(encBalance > 0 && encBalance != pubs.encryptedBalance) {
      revert PrivateToken__InvalidBalance();
    }
    if(curNonce > 0 && curNonce != pubs.balanceNonce) {
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
    if(pubs.isBurn != 0) {
      // This is a burn
      // get recip address (recipPubKey) from the sendEphemeralKey
      wrappedToken.transfer(address(uint160(pubs.sendEphemeralKey)), pubs.encryptedAmountSent * (10 ** reduceDecimals));
    } else {
      // This might be a send
      uint256 receiveTxHash = PoseidonT3.hash([pubs.encryptedAmountSent, pubs.sendEphemeralKey]);
      encryptedSends.push(PrivateSend(pubs.encryptedAmountSent, pubs.sendEphemeralKey));
      sendTree._insert(receiveTxHash);
    }

  }

  function parsePubSignals(uint[10] calldata _pubSignals) internal pure returns (PubSignals memory) {
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

}

interface IVerifier {
  function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[10] calldata _pubSignals) external view returns (bool);
}
