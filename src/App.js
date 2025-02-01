import {useState, useEffect} from 'react';
import {
  ConnectButton,
} from '@rainbow-me/rainbowkit';
import { Toaster } from 'react-hot-toast';

import WalletWrapper from "./components/WalletWrapper.js";
import Toolbar from './components/Toolbar.js';
import StatusBar from './components/StatusBar.js';
import TokenTable from './components/TokenTable.js';
import IncomingTable from './components/IncomingTable.js';

export function App() {
  const [sesh, setSesh] = useState(null);
  const [activePool, setActivePool] = useState(null);
  const [refreshCounter, setRefreshStatus] = useState(0);
  const [curView, setCurView] = useState(0);
  const [syncStatus, setSyncStatus] = useState(null);

  useEffect(() => {
    if(sesh) {
      setRefreshStatus(x => x+1);
    }
  }, [sesh]);

  return (<>
    <WalletWrapper>
      <Toaster />
      <div id="main">
        <div className="top-border" />
        <Toolbar {...{sesh, setSesh, setRefreshStatus, activePool, curView, setCurView}} />
        <div className="panel">
          {curView === 0 && <TokenTable {...{sesh, activePool, setActivePool, refreshCounter}} />}
          <IncomingTable hidden={curView!==1} {...{sesh, refreshCounter, setSyncStatus}} />
        </div>
        <StatusBar {...{sesh, refreshCounter, syncStatus}} />
      </div>
    </WalletWrapper>
  </>);
}
