import '@rainbow-me/rainbowkit/styles.css';

import {
  getDefaultConfig,
  RainbowKitProvider,
  ConnectButton,
  darkTheme,
  lightTheme,
} from '@rainbow-me/rainbowkit';
import {
  WagmiProvider,
} from 'wagmi';
import {sepolia} from 'wagmi/chains';
import {
  QueryClientProvider,
  QueryClient,
} from "@tanstack/react-query";

import DarkModeDetector from '../components/DarkModeDetector.js';

sepolia.rpcUrls.default.http[0] = 'https://rpc.ankr.com/eth_sepolia';
const wagmiConfig = getDefaultConfig({
  appName: 'Wrap on Privacy',
  projectId: '3ab784972e6540d0095810e72372cfd1',
  chains: [sepolia],
});

const queryClient = new QueryClient();

export default function WalletWrapper({ children }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <DarkModeDetector
          dark={{ theme: darkTheme({ accentColor: '#ab7663'}) }}
          light={{ theme: lightTheme({ accentColor: '#55899c'}) }}
        >
          <RainbowKitProvider>
            {children}
          </RainbowKitProvider>
        </DarkModeDetector>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
