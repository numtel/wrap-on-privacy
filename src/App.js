import {useState, useEffect} from 'react';
import {
  ConnectButton,
} from '@rainbow-me/rainbowkit';
import { Toaster } from 'react-hot-toast';

import WalletWrapper from "./components/WalletWrapper.js";
import Toolbar from './components/Toolbar.js';
import StatusBar from './components/StatusBar.js';
import TokenTable from './components/TokenTable.js';

export function App() {
  const [sesh, setSesh] = useState(null);
  const [activePool, setActivePool] = useState(null);
  const [refreshStatus, setRefreshStatus] = useState(0);
  return (<>
    <WalletWrapper>
      <Toaster />
      <div id="main">
        <div className="top-border" />
        <Toolbar {...{sesh, setSesh, setRefreshStatus, activePool}} />
        <TokenTable {...{sesh, activePool, setActivePool}} />
        <StatusBar {...{sesh}} refreshCounter={refreshStatus} />
      </div>
    </WalletWrapper>
  </>);
}
