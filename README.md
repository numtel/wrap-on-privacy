# Wrap on Privacy

![Wrap on privacy logo](public/wrap-on-privacy.png)

Deploy a privacy pool for an ERC20 that hides amounts sent and recipients

Buy a coffee without exposing your entire financial history!

[View project on ETHGlobal showcase](https://ethglobal.com/showcase/wrap-on-privacy-ryuw6)

## Installation

Requires Node.js, Circom, and Foundry installed

```sh
$ npm install
# Test circuits
$ npm run test:libraries
# Test contracts
$ npm run test:contracts

$ npm run compile:circuit

# Deploy the circuit verifier on chain
$ circuitscan login <apiKey>
$ npm run deploy:circuit

# Create .env with PRIVATE_KEY and ETHERSCAN_API_KEY
# Then, deploy the contract
$ npm run deploy:contract
```

## License

MIT

