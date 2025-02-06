import '@rainbow-me/rainbowkit/styles.css';

import {
  getDefaultConfig,
  RainbowKitProvider,
  ConnectButton,
  darkTheme,
  lightTheme,
} from '@rainbow-me/rainbowkit';
import {WagmiProvider} from 'wagmi';
import * as chains from 'wagmi/chains';
import {QueryClientProvider, QueryClient} from "@tanstack/react-query";

import DarkModeDetector from '../components/DarkModeDetector.js';

export const chainsFixed = removeDuplicates(chains);

const wagmiConfig = getDefaultConfig({
  appName: 'Wrap on Privacy',
  projectId: '3ab784972e6540d0095810e72372cfd1',
  chains: Object.values(chainsFixed),
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


function removeDuplicates(obj) {
  const uniqueIds = new Set();
  const result = {};

  for (const key in obj) {
    const currentItem = obj[key];

    // Check if the id is already in the uniqueIds set
    if (!uniqueIds.has(currentItem.id)) {
      // If not, add the id to the set and the key-value pair to the result
      uniqueIds.add(currentItem.id);
      result[key] = currentItem;
    }
  }

  return result;
}
