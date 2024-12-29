import {useState, useEffect} from 'react';
import {LockOpenIcon, LockClosedIcon, EnvelopeIcon, FolderArrowDownIcon} from '@heroicons/react/24/solid';
import SendForm from './SendForm.js';
import SetupWizard from './SetupWizard.js';

import {byChain, defaultChain} from '../contracts.js';

export default function Toolbar({sesh, setSesh}) {
  const [showSend, setShowSend] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  useEffect(() => {
    if(sesh) {
      setShowSetup(false);
    }
  }, [sesh]);
  return (<div className="toolbar">
    <div className="vr"></div>
    <button className="send" disabled={!sesh} onClick={() => setShowSend(true)}>
      <EnvelopeIcon className="h-8 w-8 block" />
      Transfer
    </button>
    {showSend && <SendForm {...{sesh, setShowSend, showSend}} tokenAddr={byChain[defaultChain].MockERC20} chainId={defaultChain} />}

    <button className="export" disabled={!sesh} onClick={() => sesh.download()}>
      <FolderArrowDownIcon className="h-8 w-8 block" />
      Export Session
    </button>

    <button className="send" onClick={() => sesh ? setSesh(null) : setShowSetup(true)}>
      {!!sesh ? <>
        <LockOpenIcon className="h-8 w-8 block" />
        Logout
      </> : <>
        <LockClosedIcon className="h-8 w-8 block" />
        Log in
      </>}
    </button>
    {showSetup && <SetupWizard {...{sesh, setSesh, setShowSetup, showSetup}} />}
  </div>);
}
