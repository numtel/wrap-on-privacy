import {
  ConnectButton,
} from '@rainbow-me/rainbowkit';
import { Toaster } from 'react-hot-toast';

import WalletWrapper from "./components/WalletWrapper.js";
import Accounts from "./components/Accounts.js";
import TestnetMint from "./components/TestnetMint.js";

const TEST_AMOUNT = 1000n * (10n ** 18n);

export function App() {
  return (<>
    <WalletWrapper>
      <Toaster />
      <ConnectButton />
      <TestnetMint amount={TEST_AMOUNT} />
      <Accounts amount={TEST_AMOUNT} />
    </WalletWrapper>
  </>);
}
