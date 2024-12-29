import {useState, useEffect} from 'react';
import {
  ConnectButton,
} from '@rainbow-me/rainbowkit';
import { Toaster } from 'react-hot-toast';

import WalletWrapper from "./components/WalletWrapper.js";
import Toolbar from './components/Toolbar.js';
import TokenTable from './components/TokenTable.js';

export function App() {
  const [sesh, setSesh] = useState(null);
  return (<>
    <WalletWrapper>
      <Toaster />
      <div id="main">
        <div className="topBorder" />
        <Toolbar {...{sesh, setSesh}} />
        <TokenTable {...{sesh}} />
      </div>
    </WalletWrapper>
  </>);
}
