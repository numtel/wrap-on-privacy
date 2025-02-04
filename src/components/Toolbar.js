import { useState, useEffect, useRef } from 'react';
import {
  useAccount,
} from 'wagmi';
import {
  useConnectModal,
  useAccountModal,
} from '@rainbow-me/rainbowkit';
import {
  LockOpenIcon,
  LockClosedIcon,
  EnvelopeIcon,
  FolderArrowDownIcon,
  WalletIcon,
} from '@heroicons/react/24/solid';
import {
  CheckIcon,
} from '@heroicons/react/16/solid';

import Dialog from './Dialog.js';
import AboutForm from './AboutForm.js';
import SendForm from './SendForm.js';
import SetupWizard, {SaveToRegistry} from './SetupWizard.js';
import DisplayAddress from './DisplayAddress.js';

import PrivateTokenSession from '../PrivateTokenSession.js';
import { byChain, defaultChain } from '../contracts.js';

export default function Toolbar({ chainId, setChainId, sesh, setSesh, setRefreshStatus, activePool, curView, setCurView }) {
  const account = useAccount();
  const connectModal = useConnectModal();
  const accountModal = useAccountModal();

  const [showAbout, setShowAbout] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showSaveToRegistry, setShowSaveToRegistry] = useState(false);
  const [showMenu, setShowMenu] = useState(0);
  const menuRef = useRef(null);

  const menu = {
    Wallet: [
      {
        label: 'Transfer Tokens...',
        onClick: () => setShowSend(true),
        disabled: !sesh || !account.isConnected,
      },
      { sep: true },
      {
        label: 'Export Session Backup',
        onClick: () => sesh.download(),
        disabled: !sesh,
      },
      {
        label: 'Log In...',
        onClick: () => setShowSetup(true),
        disabled: sesh,
      },
      {
        label: 'Log Out',
        onClick: () => setSesh(null),
        disabled: !sesh,
      },
      { sep: true },
      {
        label: account.isConnected ? `Connected as ${account.address.slice(0,8)}...` : 'Connect Wallet...',
        onClick: () => account.isConnected ? accountModal.openAccountModal(): connectModal.openConnectModal(),
      },
      {
        label: 'Save Public Key to Registry...',
        onClick: () => setShowSaveToRegistry(true),
        disabled: !sesh || !account.isConnected,
      },
    ],
    Chain: Object.values(byChain).map(({chain}) => ({
      label: `${chain.name}`,
      checked: chainId === chain.id,
      onClick: () => setChainId(chain.id),
    })),
    View: [
      {
        label: 'Refresh',
        onClick: () => setRefreshStatus(x => x+1),
      },
      { sep: true },
      {
        label: 'Token List',
        checked: curView === 0,
        onClick: () => setCurView(0),
      },
      {
        label: 'Incoming Transactions',
        checked: curView === 1,
        onClick: () => setCurView(1),
        disabled: !sesh,
      },
    ],
    Help: [
      {
        label: 'About',
        onClick: () => setShowAbout(true),
      },
    ],
  };

  useEffect(() => {
    if (sesh) {
      setShowSetup(false);
    }
  }, [sesh]);

  useEffect(() => {
    setRefreshStatus(x => x+1);
  }, [chainId]);

  useEffect(() => {
    if(!sesh && PrivateTokenSession.hasLocalStorage()) {
      setShowSetup(true);
    }

    function handleOutsideClick(event) {
      if (menuRef.current && (!menuRef.current.contains(event.target) || menuRef.current === event.target)) {
        setShowMenu(0);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setShowMenu(0);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  function overMenu(index) {
    return function () {
      if (showMenu > 0) setShowMenu(index);
    };
  }

  return (
    <>
      <div className="toolbar menubar" ref={menuRef}>
        <div className="vr"></div>
        {Object.keys(menu).map((key, index) => (
          <button
            key={index}
            className={`${showMenu === index + 1 ? 'active' : ''}`}
            onClick={() => setShowMenu(showMenu === index + 1 ? 0 : index + 1)}
            onMouseOver={overMenu(index + 1)}
          >
            {key}
            <Dialog
              show={showMenu === index + 1}
              setShow={() => {}}
              noClose={true}
              className={`menu`}
            >
              {menu[key].map((item, itemIndex) =>
                item.sep ? (
                  <div key={itemIndex} className="hr" />
                ) : (
                  <button
                    key={itemIndex}
                    {...item}
                    onClick={() => {
                      setShowMenu(0);
                      item.onClick();
                    }}
                  >
                    {item.checked && <CheckIcon className="h-4 w-4 block" />}
                    {item.label}
                  </button>
                )
              )}
            </Dialog>
          </button>
        ))}
      </div>
      <div className="toolbar">
        <div className="vr"></div>
        <button
          className="send"
          disabled={!sesh || !account.isConnected}
          onClick={() => setShowSend(true)}
        >
          <EnvelopeIcon className="h-8 w-8 block" />
          Transfer
        </button>
        <AboutForm {...{ chainId, setShowAbout, showAbout }} />
        {showSend && (
          <SendForm
            {...{ chainId, sesh, setShowSend, showSend, setRefreshStatus }}
            tokenAddr={activePool}
          />
        )}

        <button
          className="export"
          disabled={!sesh}
          onClick={() => sesh.download()}
        >
          <FolderArrowDownIcon className="h-8 w-8 block" />
          Export
        </button>

        <button
          className="sesh"
          onClick={() => (sesh ? setSesh(null) : setShowSetup(true))}
        >
          {!!sesh ? (
            <>
              <LockOpenIcon className="h-8 w-8 block" />
              Logout
            </>
          ) : (
            <>
              <LockClosedIcon className="h-8 w-8 block" />
              Log in
            </>
          )}
        </button>
        {showSetup && <SetupWizard {...{ sesh, setSesh, setShowSetup, showSetup }} />}
        <SaveToRegistry {...{chainId, sesh, showSaveToRegistry, setShowSaveToRegistry, setRefreshStatus}} />
        <button
          className="wallet"
          onClick={() => account.isConnected ? accountModal.openAccountModal(): connectModal.openConnectModal()}
        >
          <WalletIcon className="h-8 w-8 block" />
          {account.isConnected ? <DisplayAddress address={account.address} /> : 'Wallet'}
        </button>
      </div>
    </>
  );
}

