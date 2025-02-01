import {sepolia, holesky} from 'wagmi/chains';
sepolia.rpcUrls.default.http[0] = 'https://rpc.ankr.com/eth_sepolia';

export const byChain = {
  11155111: {
    PrivateToken: '0xC58D3371Aac24b98bd39c9c64681FFeA26455f61',
    KeyRegistry: '0x1BbF48d8178743605C0BE1e5708Bf7e0a38B22E0',
    explorer: 'https://sepolia.etherscan.io/address/',
    chain: sepolia,
  },
  17000: {
    PrivateToken: '0xc56553eD0c94971E36cF9d41C45d030B3D53A7bc',
    KeyRegistry: '0x9CE924e8FF0FA7B962f65daA425CcFf2e56063a4',
    explorer: 'https://holesky.etherscan.io/address/',
    chain: holesky,
  },
}

export const defaultChain = 11155111;
