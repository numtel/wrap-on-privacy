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
import { defaultPool } from './contracts.js';

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
  const [pool, setPool] = useState(defaultPool);
  const [sesh, setSesh] = useState(null);
  // TODO should be called activeToken instead
  const [activePool, setActivePool] = useState(null);
  const [refreshCounter, setRefreshStatus] = useState(0);
  const [curView, setCurView] = useState(0);
  const [syncStatus, setSyncStatus] = useState(null);
  const [cssInsert, setCssInsert] = useState(null);

  useEffect(() => {
    setCssInsert(sesh && `
      #main {
        ${Object.keys(sesh.colorScheme)
          .filter(key => sesh.colorScheme[key] !== null)
          .map(key => `--${key}: ${sesh.colorScheme[key]};`)
          .join('\n')}
      }
    `);
  }, [refreshCounter, sesh]);

  useEffect(() => {
    if(sesh) {
      setRefreshStatus(x => x+1);
    }
  }, [sesh]);

  return (
    <div id="main">
      <div className="top-border" />
      <Toolbar {...{pool, setPool, sesh, setSesh, setRefreshStatus, activePool, curView, setCurView, setSyncStatus, syncStatus}} />
      <div className="panel">
        {curView === 0 && <TokenTable {...{pool, sesh, activePool, setActivePool, refreshCounter}} />}
        <IncomingTable hidden={curView!==1} {...{pool, sesh, refreshCounter, setRefreshStatus, syncStatus, setSyncStatus, setActivePool}} />
      </div>
      <StatusBar {...{pool, sesh, refreshCounter, syncStatus}} />
      {cssInsert && <style>{cssInsert}</style>}
    </div>
  );
}
