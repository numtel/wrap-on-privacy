import {useRef, useState, useEffect} from 'react';
import { toast } from 'react-hot-toast';
import {
  useAccount,
  useSwitchChain,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';

import PrivateTokenSession, {poolId, storeJSON} from '../PrivateTokenSession.js';

import FileDropZone from './FileDropZone.js';
import Dialog from './Dialog.js';
import {DISABLED_STATUS} from './IncomingTable.js';

export default function SetupWizard({ sesh, setSesh, showSetup, setShowSetup, setPool, setCurView, setSyncStatus }) {
  const [step, setStep] = useState(PrivateTokenSession.hasLocalStorage() ? -1 : 0);
  const primaryInputRef = useRef(null);

  useEffect(() => {
    if (primaryInputRef.current) {
      primaryInputRef.current.focus();
    }
  }, [step]);
  return (<Dialog
      title={
        step === -1 ? 'Login to Session' :
        step === 0 ? 'Wrap on Privacy Setup Wizard' :
        step === 1 ? 'Import Session File' :
        step === 2 ? 'Set Session Password' : 'Wrap on Privacy'
      }
      show={showSetup}
      setShow={setShowSetup}
    >
    {step === -1 && <Login {...{sesh, setSesh, setStep, setPool, setCurView, setSyncStatus}} />}
    {step === 2 && <SetPassword {...{sesh, setSesh, setStep}} />}
    {step === 1 && <ImportSession {...{sesh, setSesh, setStep}} />}
    {step === 0 && <>
      <div className="flex">
        <div className="banner"></div>
        <div>
          <p>Generate an account key for private ERC20 transactions.</p>
          <p>This key is stored inside your browser session. You may export your session to a file.</p>
          <p>Click next to create a new key or 'Import' to load a session file from your device.</p>
        </div>
      </div>
      <div className="hr"></div>
      <div className="controls">
        <button className="button" onClick={() => setStep(1)}>
          Import
        </button>
        {PrivateTokenSession.hasLocalStorage() &&
          <button className="button" type="button" onClick={() => setStep(-1)}>
            Login
          </button>}
        <button ref={primaryInputRef} className="button" onClick={() => setStep(2)}>
          Next &gt;
        </button>
      </div>
    </>}
  </Dialog>);
}

function Login({sesh, setSesh, setStep, setPool, setCurView, setSyncStatus}) {
  const [newPw, setNewPw] = useState('');
  const [disableSync, setDisableSync] = useState(false);
  const passwordInputRef = useRef(null);

  useEffect(() => {
    // Focus the password input when the component mounts
    if (passwordInputRef.current) {
      setTimeout(() => passwordInputRef.current.focus(), 1);
    }
  }, []);

  async function onNext(event) {
    event.preventDefault();
    try {
      toast.loading('Loading session...');
      const sesh = await PrivateTokenSession.loadFromLocalStorage(newPw, {disableSync});
      // Restore session viewport
      if(sesh.lastPool) {
        const thisPool = sesh.pools.filter(x => poolId(x) === sesh.lastPool);
        if(thisPool.length > 0) {
          setPool(thisPool[0]);
        }
      }
      if(sesh.lastView) {
        setCurView(sesh.lastView);
      }
      if(sesh.disableSync) {
        setSyncStatus(DISABLED_STATUS);
      }
      setSesh(sesh);
      toast.dismiss();
      toast.success('Login Successful!');
    } catch(error) {
      console.error(error);
      toast.dismiss();
      toast.error('Login Failed!');
      return;
    }
  }
  return (<>
    <form onSubmit={onNext}>
      <div className="flex">
        <div className="banner"></div>
        <div>
          <p>Welcome back to Wrap on Privacy!</p>
          <p>Please input your password to decrypt the session, or click 'Reset Session' to begin a new session.</p>
          <label className="text">
            <span>Password:</span>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              ref={passwordInputRef}
            />
          </label>
          <label className="radio">
            <input type="checkbox" checked={disableSync} onChange={e => setDisableSync(e.target.checked)} />
            <span>Disable Sync</span>
          </label>
        </div>
      </div>
      <div className="hr"></div>
      <div className="controls">
        <button className="button" type="button" onClick={() => setStep(0)}>
          Reset Session
        </button>
        <button className="button" disabled={!newPw}>
          Login
        </button>
      </div>
    </form>
  </>);
}

function ImportSession({sesh, setStep}) {
  async function onFile(file) {
    if(PrivateTokenSession.hasLocalStorage() &&
      !confirm('Are you sure you wish to overwrite the existing session?\n\n' +
        'If you do not have the session backup file, ' +
        'you will lose access to any private funds from the account.')) {
      throw new Error('Session overwrite aborted!');
    }
    await storeJSON(file);
    setStep(-1);
  }
  return (<>
    <div className="flex">
      <div className="banner import"></div>
      <div>
        <p>Select a session backup file from your device.</p>
        <FileDropZone onFileSelect={onFile} />
      </div>
    </div>
    <div className="hr"></div>
    <div className="controls">
      <button className="button" onClick={() => setStep(0)}>
        &lt; Back
      </button>
    </div>
  </>);
}

function SetPassword({sesh, setSesh, setStep}) {
  const [newPw, setNewPw] = useState('');
  const [downloadSesh, setDownloadSesh] = useState(true);
  const primaryInputRef = useRef(null);

  useEffect(() => {
    if (primaryInputRef.current) {
      primaryInputRef.current.focus();
    }
  }, []);

  async function onNext(event) {
    event.preventDefault();
    try {
      if(PrivateTokenSession.hasLocalStorage() &&
        !confirm('Are you sure you wish to overwrite the existing session?\n\n' +
          'If you do not have the session backup file, ' +
          'you will lose access to any private funds from the account.')) {
        throw new Error('Session overwrite aborted!');
      }
      toast.loading('Generating new private session...');
      const newSesh = new PrivateTokenSession({
        password: newPw,
      });
      await newSesh.init();
      await newSesh.saveToLocalStorage();
      toast.dismiss();
      toast.success('New private session created!');
      if(downloadSesh) await newSesh.download();
      setSesh(newSesh);
    } catch(error) {
      console.error(error);
      toast.dismiss();
      toast.error(error.message);
      return;
    }
  }
  return (<>
    <form onSubmit={onNext}>
      <div className="flex">
        <div className="banner password"></div>
        <div>
          <p>This password is used to encrypt your session file.</p>
          <p>There is no way to recover this password. <em>DO NOT LOSE IT!</em></p>
          {PrivateTokenSession.hasLocalStorage() && <p className="text-red-800 dark:text-red-400">Clicking next will overwrite the existing session in your local storage.</p>}
          <label className="text">
            <span>New password:</span>
            <input ref={primaryInputRef} type="password" value={newPw} onChange={e => setNewPw(e.target.value)} />
          </label>
          <label className="radio">
            <input type="checkbox" checked={downloadSesh} onChange={e => setDownloadSesh(e.target.checked)} />
            <span>Download Session File Backup</span>
          </label>
        </div>
      </div>
      <div className="hr"></div>
      <div className="controls">
        <button className="button" type="button" onClick={() => setStep(0)}>
          &lt; Back
        </button>
        <button className="button" disabled={!newPw}>
          Create new Private Wallet
        </button>
      </div>
    </form>
  </>);
}

export function ChangePw({sesh, showChangePw, setShowChangePw}) {
  const [newPw, setNewPw] = useState('');
  const [downloadSesh, setDownloadSesh] = useState(true);
  const primaryInputRef = useRef(null);

  async function onNext(event) {
    event.preventDefault();
    try {
      sesh.password = newPw;
      await sesh.saveToLocalStorage();
      toast.dismiss();
      toast.success('Password changed!');
      setShowChangePw(false);
      if(downloadSesh) await sesh.download();
    } catch(error) {
      console.error(error);
      toast.dismiss();
      toast.error(error.message);
      return;
    }
  }

  useEffect(() => {
    if (showChangePw && primaryInputRef.current) {
      primaryInputRef.current.focus();
    }
  }, [showChangePw]);

  return (<Dialog title="Change Session Password" show={showChangePw} setShow={setShowChangePw}>
    <form onSubmit={onNext}>
      <label className="text">
        <span>New password:</span>
        <input ref={primaryInputRef} type="password" value={newPw} onChange={e => setNewPw(e.target.value)} />
      </label>
      <label className="radio">
        <input type="checkbox" checked={downloadSesh} onChange={e => setDownloadSesh(e.target.checked)} />
        <span>Download Session File Backup</span>
      </label>
      <div className="controls center">
        <button className="button" disabled={!newPw}>
          Change Password
        </button>
      </div>
    </form>
  </Dialog>);
}

export function SaveToRegistry({pool, sesh, showSaveToRegistry, setShowSaveToRegistry, setRefreshStatus}) {
  const account = useAccount();
  const { switchChainAsync } = useSwitchChain();

  const { writeContract, isPending, isError, data, error: writeError } = useWriteContract();
  const { isError: txError, isPending: txPending, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: data });
  const primaryInputRef = useRef(null);
  const disabled = !account.isConnected || isPending || (data && txPending);

  useEffect(() => {
    if (showSaveToRegistry && primaryInputRef.current) {
      primaryInputRef.current.focus();
    }
  }, [showSaveToRegistry, disabled]);

  useEffect(() => {
    txSuccess && toast.success('Public Key Registered!');
  }, [ txSuccess ]);

  useEffect(() => {
    toast.dismiss();
    if(!data && isPending) {
      toast.loading('Waiting for user to submit...');
    } else if(!data && isError) {
      console.error(writeError);
      toast.error('Error submitting.');
    } else if(data && txError) {
      toast.error('Transaction error!');
    } else if(data && txPending) {
      toast.loading('Waiting for transaction...');
    } else if(data && txSuccess) {
      setShowSaveToRegistry(false);
      setRefreshStatus(x=> x + 1);
      // TODO set incoming count to current length if undefined to skip unnecessary loading
      toast.success('Successfully registered public key!');
    }
  }, [data, isPending, isError, txError, txPending, txSuccess]);

  async function registerKey() {
    const tx = sesh.registerTx(pool);
    if(account.chainId !== pool.KeyRegistry.chain.id) {
      await switchChainAsync({ chainId: pool.KeyRegistry.chain.id });
    }
    writeContract(tx);
  }
  return (<Dialog title="Save Public Key to Registry" show={showSaveToRegistry} setShow={setShowSaveToRegistry}>
    <div className="flex">
      <div className="banner registry"></div>
      <div>
        <p>Submit this transaction so that you can receive privately at your Ethereum address on this chain.</p>
        {!account.isConnected && <p className="text-red-800 dark:text-red-400">Connect wallet to continue!</p>}
      </div>
    </div>
    <div className="hr"></div>
    <div className="controls">
      <span>&nbsp;</span>
      <button
        ref={primaryInputRef}
        className="button"
        onClick={registerKey}
        {...{disabled}}
      >
        Register Public Key
      </button>
    </div>
  </Dialog>);
}
