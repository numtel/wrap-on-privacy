# Wrap on Privacy

*This project has not been audited and should not be used in production!*

Transaction notes encrypted using [post-quantum NTRU algorithm](https://github.com/numtel/ntru-circom)

Buy a coffee without exposing your entire financial history!

* [Deployed on Github](https://numtel.github.io/wrap-on-privacy/) (so you can trust its source to be unmodified)
* [Protocol Documentation](PROTOCOL.md)
* [Project started at ETHGlobal Bangkok 2024](https://ethglobal.com/showcase/wrap-on-privacy-ryuw6)

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

### Relayers

There is no system to "relay" proofs built into Wrap on Privacy. There are no added fees for sending privately. There is no way to profit from someone else's transactions.

In this system, the recipient and amount sent are obscured. While it will still be public that your account is making transactions, the contents of those transactions will be private.

Property | Public | Private
---------|--------|------------------
Source account | :white_check_mark: | &nbsp;
Token Type | &nbsp; | :white_check_mark:
Transaction Amount | &nbsp; | :white_check_mark:
Recipient account | &nbsp; | :white_check_mark:

Also, there is no public distinction between sending and receiving an incoming transaction since they use the same proof.

> [!IMPORTANT]
> Token type is pseudonymous hash `poseidon2([private key, token address])`
>
> A public transaction on an account (mint or burn) will reveal the link between token type and the hash so don't use the same account if you want that privacy quality.


## Login vs Connect Wallet

To be usable, Wrap on Privacy requires both logging into a private session as well as connecting a wallet.

The connected wallet is for submitting transactions and for public balances.

The private session is for decrypting private balances and incoming transactions as well as providing the public key by which incoming transactions are encrypted.

An incoming transaction will only decrypt successfully by the intended recipient. The client attempts to decrypt every encrypted transaction, displaying only those which successfully decrypt by the private key in your private session.

## Key Registry

In order to allow receiving privately on a standard Ethereum address or ENS name, public keys are stored on-chain in a key registry.

You may update your public key as often as needed.

The status bar will display a green check if your key is registered at the current address.

## Pool Manager

Deploy compatible `PrivacyToken` and `KeyRegistry` contracts to any EVM chain then load your pool in the Pool Manager.

The base contract in this repository that is deployed on Sepolia allows anyone access to the pool for any ERC20 token but you could add rules and change the configuration for your pool.

## References

* [Control as Liability by Vitalik Buterin](https://vitalik.eth.limo/general/2019/05/09/control_as_liability.html)

    This philosophy directs the shape of Wrap on Privacy

* [Blockchain privacy and regulatory compliance: Towards a practical equilibrium](https://www.sciencedirect.com/science/article/pii/S2096720923000519)

    How to integrate ASPs into Wrap on Privacy? Is there more than just adding a second merkle tree calculation to the proof that is not verified by the contract?

## License

MIT

