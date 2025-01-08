# Wrap on Privacy

An attempt to move beyond "note passing" as introduced by Tornado Cash by incorporating public key encryption using [the NTRU algorithm](https://github.com/numtel/ntru-circom)

Buy a coffee without exposing your entire financial history!

[Project started at ETHGlobal Bangkok 2024](https://ethglobal.com/showcase/wrap-on-privacy-ryuw6)

## Installation

Requires Node.js, Circom, and Foundry installed

> [Circuitscan CLI](https://github.com/circuitscan/cli) required to deploy and verify circuits

```sh
$ npm install

# Run frontend locally
$ npm run dev

# Test circuits
$ npm run test:libraries
# Test contracts
$ npm run test:contracts

# Compile circuits before attempting to deploy them
$ npm run compile:circuit
$ npm run compile:mint-circuit

# Deploy the circuit verifier on chain
$ circuitscan login <apiKey>
$ npm run deploy:circuit

# Create .env with PRIVATE_KEY and ETHERSCAN_API_KEY
# Update the verifier contract addresses in the script in package.json
# Then, deploy the contract
$ npm run deploy:contract

# Also, the key registry contract may be deployed
$ npm run deploy:registry-contract
```

## Transfer Types

&nbsp;| Public Source | Private Source
----|---------------|------------------
Public Recipient | Standard ERC20 Transfer | Burn out of privacy pool
Private Recipient | Mint into privacy pool | Send within pool

Mint proof must be sent by the account holding the ERC20 tokens but burn proofs and sending within the pool can be sent by any account.

## Relayers

There is no system to "relay" proofs built into Wrap on Privacy. There are no added fees for sending privately. There is no way to profit from someone else's transactions.

For most transactions, obscuring the recipient and amount sent is sufficient privacy.

### Login vs Connect Wallet

To be usable, Wrap on Privacy requires both logging into a private session as well as connecting a wallet.

The connected wallet is for submitting transactions and for public balances.

The private session is for decrypting private balances and incoming transactions as well as providing the public key by which incoming transactions are encrypted.

An incoming transaction will only decrypt successfully by the intended recipient. The client attempts to decrypt every encrypted transaction, displaying only those which successfully decrypt by the private key in your private session.

To also obscure the source of the funds, a user may act as a relayer themselves and log into their private session using a different wallet address and submit the transaction. The recipient will see this relayer account as the "Sender" of the transaction.

The status bar will show that the user cannot receive privately at that address but you can still send privately from the same private session.

## Key Registry

In order to allow sending privately to a standard Ethereum address or ENS name, public keys are stored on-chain in a key registry.

You may update your public key as often as needed.

## References

* [Control as Liability by Vitalik Buterin](https://vitalik.eth.limo/general/2019/05/09/control_as_liability.html)

    This philosophy directs the shape of Wrap on Privacy

* [Blockchain privacy and regulatory compliance: Towards a practical equilibrium](https://www.sciencedirect.com/science/article/pii/S2096720923000519)

    How to integrated ASPs into Wrap on Privacy? There must be more than just adding a second merkle tree calculation to the proof that's unchecked by the contract

## License

MIT

