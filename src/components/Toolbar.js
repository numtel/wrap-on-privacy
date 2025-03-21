import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import {useAccount} from 'wagmi';
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
import SetupWizard, {SaveToRegistry, ChangePw} from './SetupWizard.js';
import DisplayAddress from './DisplayAddress.js';
import PoolMan from './PoolMan.js';
import PoolDeploy from './PoolDeploy.js';
import ImportTx from './ImportTx.js';
import ColorScheme from './ColorScheme.js';
import {DISABLED_STATUS} from './IncomingTable.js';

import PrivateTokenSession, {poolId} from '../PrivateTokenSession.js';
import { defaultPool } from '../contracts.js';

export default function Toolbar({ pool, setPool, sesh, setSesh, setRefreshStatus, activePool, curView, setCurView, setSyncStatus }) {
  const account = useAccount();
  const connectModal = useConnectModal();
  const accountModal = useAccountModal();

  const [showAbout, setShowAbout] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showSaveToRegistry, setShowSaveToRegistry] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [showMenu, setShowMenu] = useState(0);
  const [showPoolMan, setShowPoolMan] = useState(false);
  const [showPoolDeploy, setShowPoolDeploy] = useState(false);
  const [showColorScheme, setShowColorScheme] = useState(false);
  const [importTx, setImportTx] = useState(null);
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
        label: 'Change Password...',
        onClick: () => setShowChangePw(true),
        disabled: !sesh,
      },
      {
        label: 'Import Incoming Transaction...',
        onClick: async () => {
          try {
            toast.loading('Importing transaction...');
            const imported = await sesh.importIncoming(pool);
            setImportTx(imported);
            toast.dismiss();
          } catch(error) {
            toast.dismiss();
            toast.error(error.message || 'Unable to import transaction!');
            console.error(error);
          }
        },
        disabled: !sesh || !account.isConnected,
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
    Pool: [
      ...(sesh ? sesh.pools.map(thisPool => ({
        label: thisPool.name,
        checked: poolId(pool) === poolId(thisPool),
        onClick: () => {
          sesh.lastPool = poolId(thisPool);
          sesh.saveToLocalStorage();
          setPool(thisPool);
        },
      })) : [{
        label: defaultPool.name,
        checked: true,
        onClick: () => {},
      }]),
      { sep: true },
      {
        label: 'Manage Pools...',
        disabled: !sesh,
        onClick: () => setShowPoolMan(true),
      },
      {
        label: 'Deploy New Pool...',
        disabled: !sesh,
        onClick: () => setShowPoolDeploy(true),
      },
    ],
    View: [
      {
        label: 'Refresh',
        onClick: () => setRefreshStatus(x => x+1),
      },
      {
        label: 'Configure Color Scheme...',
        disabled: !sesh,
        onClick: () => setShowColorScheme(true),
      },
      {
        label: 'Hide Already Accepted',
        disabled: !sesh,
        checked: sesh && sesh.hideAlreadyAccepted,
        onClick: () => {
          sesh.hideAlreadyAccepted = !sesh.hideAlreadyAccepted;
          sesh.saveToLocalStorage();
          setRefreshStatus(x => x+1);
        },
      },
      {
        label: 'Disable Incoming Sync',
        disabled: !sesh,
        checked: sesh && sesh.disableSync,
        onClick: () => {
          sesh.disableSync = !sesh.disableSync;
          sesh.saveToLocalStorage();
          setSyncStatus(curVal => sesh.disableSync ? DISABLED_STATUS : null);
          setRefreshStatus(x => x+1);
        },
      },
      { sep: true },
      {
        label: 'Token List',
        checked: curView === 0,
        onClick: () => {
          if(!sesh) return;
          sesh.lastView = 0;
          sesh.saveToLocalStorage();
          setCurView(0);
        },
      },
      {
        label: 'Incoming Transactions',
        checked: curView === 1,
        disabled: !sesh,
        onClick: () => {
          sesh.lastView = 1;
          sesh.saveToLocalStorage();
          setCurView(1);
        },
      },
      {
        label: 'Outgoing Transactions',
        checked: curView === 2,
        disabled: !sesh,
        onClick: () => {
          sesh.lastView = 2;
          sesh.saveToLocalStorage();
          setCurView(2);
        },
      },
    ],
    Help: [
      {
        label: 'About...',
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
  }, [pool]);

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
      {showPoolMan && <PoolMan {...{sesh, setShowPoolMan, showPoolMan}} />}
      {showPoolDeploy && <PoolDeploy {...{sesh, pool, setShowPoolDeploy, showPoolDeploy}} />}
      {showColorScheme && <ColorScheme {...{sesh, setShowColorScheme, showColorScheme, setRefreshStatus}} />}
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
        <AboutForm {...{ pool, setShowAbout, showAbout }} />
        {showSend && (
          <SendForm
            {...{ pool, sesh, setShowSend, showSend, setRefreshStatus }}
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
        {showSetup && <SetupWizard {...{ sesh, setSesh, setShowSetup, showSetup, setPool, setCurView, setSyncStatus }} />}
        <SaveToRegistry {...{pool, sesh, showSaveToRegistry, setShowSaveToRegistry, setRefreshStatus}} />
        {importTx && <ImportTx {...{importTx, setImportTx, sesh, pool, setRefreshStatus}} />}
        <ChangePw {...{sesh, showChangePw, setShowChangePw}} />
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

