# Wrap on Privacy Protocol Documentation

## User Accounts

User accounts consist of a viewing key and a balance (spending) key.

Key | Description
----|-------------------------
View | Used for notice data encryption, (i.e. obscuring the recipient) NTRU 192-bit
Balance | Able to view/update the account balance, Poseidon hash

## State Transitions

All user interactions with the main contract are submitted using the `verifyProof()` function.

The four types of proofs are classed by the `publicMode` input signal:

Public Mode | Description
------------|---------------
`0` | A private transaction, either a send or a receive
`1` | Mint into pool
`2` | Burn from pool

Along with the proof data, `verifyProof()` accepts a free-form notice data value.

This notice data should be a ciphertext encrypted for the recipient public (viewing) key with the necessary details to recreate the transaction hash.

Transaction Hash Component | Description
---------------------------|----------------
`chainId` | From contract deployment
`recipPublicKey` | From user account
`tokenAddr` | Transmitted in notice data
`sendAmount` | Transmitted in notice data
`sendBlinding` | Transmitted in notice data

While this frontend uses NTRU, the protocol does not impose any specific algorithm for notice data encryption. Adding more available algorithms only requires updating the frontend.

