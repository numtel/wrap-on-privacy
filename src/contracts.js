import {sepolia} from 'wagmi/chains';
sepolia.rpcUrls.default.http[0] = 'https://rpc.ankr.com/eth_sepolia';

export const defaultPool = {
  name: 'Sepolia Test Pool',
  PrivateToken: {
    address: '0x96b0e23b7d4724bcbc03bc0da33cc839a679031c',
    chain: sepolia,
  },
  KeyRegistry: {
    address: '0x1BbF48d8178743605C0BE1e5708Bf7e0a38B22E0',
    chain: sepolia,
  },
};

