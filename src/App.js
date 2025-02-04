import {useState, useEffect} from 'react';
import {
  ConnectButton,
} from '@rainbow-me/rainbowkit';
import {
  useAccount,
} from 'wagmi';
import { Toaster } from 'react-hot-toast';

import WalletWrapper from "./components/WalletWrapper.js";
import Toolbar from './components/Toolbar.js';
import StatusBar from './components/StatusBar.js';
import TokenTable from './components/TokenTable.js';
import IncomingTable from './components/IncomingTable.js';
import { byChain, defaultChain } from './contracts.js';

export function App() {
  return (<>
    <WalletWrapper>
      <Toaster />
      <AppInner />
    </WalletWrapper>
  </>);
}

function AppInner() {
  const account = useAccount();
  const [chainId, setChainId] = useState(() => {
    let chainId = account.chainId || defaultChain;
    if(!(chainId in byChain)) chainId = defaultChain;
    return chainId;
  });
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

  return (
    <div id="main">
      <div className="top-border" />
      <Toolbar {...{chainId, setChainId, sesh, setSesh, setRefreshStatus, activePool, curView, setCurView}} />
      <div className="panel">
        {curView === 0 && <TokenTable {...{chainId, sesh, activePool, setActivePool, refreshCounter}} />}
        <IncomingTable hidden={curView!==1} {...{chainId, sesh, refreshCounter, setRefreshStatus, syncStatus, setSyncStatus, setActivePool}} />
      </div>
      <StatusBar {...{chainId, sesh, refreshCounter, syncStatus}} />
    </div>
  );
}
