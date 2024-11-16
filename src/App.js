import {
  ConnectButton,
} from '@rainbow-me/rainbowkit';

import WalletWrapper from "./components/WalletWrapper.js";

export function App() {
  return (<>
    <WalletWrapper>
      <ConnectButton />
      <p className="text-red-500">Foo</p>
    </WalletWrapper>
  </>);
}
