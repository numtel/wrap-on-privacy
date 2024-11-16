# Wrap on Privacy

Deploy a privacy pool for an ERC20 that hides amounts sent and recipients

Buy a coffee without exposing your entire financial history!

## Installation

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

