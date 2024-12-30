import {useRef, useState, useEffect} from 'react';
import { toast } from 'react-hot-toast';
import {
  useAccount,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';

import PrivateTokenSession, {SESH_KEY} from '../PrivateTokenSession.js';

import FileDropZone from './FileDropZone.js';
import Dialog from './Dialog.js';

export default function SetupWizard({ sesh, setSesh, showSetup, setShowSetup }) {
  const [step, setStep] = useState(PrivateTokenSession.hasLocalStorage() ? -1 : 0);
  const primaryInputRef = useRef(null);

  useEffect(() => {
    if (primaryInputRef.current) {
      primaryInputRef.current.focus();
    }
  }, [step]);
  return (<Dialog show={showSetup} setShow={setShowSetup}>
    {step === -1 && <Login {...{sesh, setSesh, setStep}} />}
    {step === 3 && <SaveToRegistry {...{sesh, setSesh, setStep}} />}
    {step === 2 && <SetPassword {...{sesh, setSesh, setStep}} />}
    {step === 1 && <ImportSession {...{sesh, setSesh, setStep}} />}
    {step === 0 && <>
      <h2>Wrap on Privacy Setup Wizard</h2>
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

function Login({sesh, setSesh, setStep}) {
  const [newPw, setNewPw] = useState('');
  const passwordInputRef = useRef(null);

  useEffect(() => {
    // Focus the password input when the component mounts
    if (passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  }, []);

  async function onNext(event) {
    event.preventDefault();
    try {
      setSesh(await PrivateTokenSession.loadFromLocalStorage(newPw));
      toast.success('Login Successful!');
    } catch(error) {
      console.error(error);
      toast.error('Login Failed!');
      return;
    }
  }
  return (<>
    <h2>Login to Session</h2>
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
  function onFile(file) {
    if(PrivateTokenSession.hasLocalStorage() &&
      !confirm('Are you sure you wish to overwrite the existing session?\n\n' +
        'If you do not have the session backup file, ' +
        'you will lose access to any private funds from the account.')) {
      throw new Error('Session overwrite aborted!');
    }
    localStorage.setItem(SESH_KEY, file);
    setStep(-1);
  }
  return (<>
    <h2>Import Session File</h2>
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
      const newSesh = new PrivateTokenSession({
        password: newPw,
      });
      await newSesh.saveToLocalStorage();
      if(downloadSesh) await newSesh.download();
      setSesh(newSesh);
    } catch(error) {
      console.error(error);
      toast.error(error.message);
      return;
    }
  }
  return (<>
    <h2>Set Session Password</h2>
    <form onSubmit={onNext}>
      <div className="flex">
        <div className="banner password"></div>
        <div>
          <p>This password is used to encrypt your session file.</p>
          <p>There is no way to recover this password. <em>DO NOT LOSE IT!</em></p>
          {PrivateTokenSession.hasLocalStorage() && <p className="text-red-800">Clicking next will overwrite the existing session in your local storage.</p>}
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

export function SaveToRegistry({sesh, setStep}) {
  const account = useAccount();

  const { writeContract, isPending, isError, data, error: writeError } = useWriteContract();
  const { isError: txError, isPending: txPending, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: data });
  useEffect(() => {
    txSuccess && console.log('done');
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
      toast.success('Successfully registered public key!');
    }
  }, [data, isPending, isError, txError, txPending, txSuccess]);

  function registerKey() {
    const tx = sesh.registerTx();
    console.log(tx);
//     writeContract(tx);
  }
  return (<Dialog>
    <h2>Save Public Key to Registry</h2>
    <div className="flex">
      <div className="banner registry"></div>
      <div>
        <p>Submit this transaction so that you can receive privately at your Ethereum address on this chain.</p>
        {!account.isConnected && <p className="text-red-800">Connect wallet to continue!</p>}
      </div>
    </div>
    <div className="hr"></div>
    <div className="controls">
      <button className="button" disabled={isPending || (data && txPending)} onClick={() => setStep(2)}>
        &lt; Back
      </button>
      <button className="button" disabled={!account.isConnected || isPending || (data && txPending)} onClick={registerKey}>
        Register Public Key
      </button>
    </div>
  </Dialog>);
}
