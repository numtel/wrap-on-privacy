import {
  ConnectButton,
} from '@rainbow-me/rainbowkit';

import WalletWrapper from "./components/WalletWrapper.js";
import Accounts from "./components/Accounts.js";
import TestnetMint from "./components/TestnetMint.js";

export function App() {
  return (<>
    <WalletWrapper>
      <ConnectButton />
      <TestnetMint amount={100000n} />
      <Accounts />
    </WalletWrapper>
  </>);
}
