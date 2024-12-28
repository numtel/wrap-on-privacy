import {useState} from 'react';

import FileDropZone from './FileDropZone.js';

export default function SetupWizard() {
  const [step, setStep] = useState(0);
  if(step === 2) return (<SaveToRegistry {...{setStep}} />);
  if(step === 1) return (<ImportSession {...{setStep}} />);
  if(step === 0) return (<dialog open>
    <h2>Wrap on Privacy Setup Wizard</h2>
    <div className="banner"></div>
    <p>Generate an account key for private ERC20 transactions.</p>
    <p>This key is stored inside your browser session. You may export your session to a file.</p>
    <p>Click next to create a new key or 'Import' to load a session file from your device.</p>
    <div className="hr"></div>
    <div className="controls">
      <button className="button" onClick={() => setStep(1)}>
        Import
      </button>
      <button className="button" onClick={() => setStep(2)}>
        Next &gt;
      </button>
    </div>
  </dialog>);
}

function ImportSession({setStep}) {
  function onFile(file) {
    console.log(file);
  }
  return (<dialog open>
    <h2>Import Session File</h2>
    <div className="banner import"></div>
    <p>Select a file from your device.</p>
    <FileDropZone onFileSelect={onFile} />
    <div className="hr"></div>
    <div className="controls">
      <button className="button" onClick={() => setStep(0)}>
        &lt; Back
      </button>
    </div>
  </dialog>);
}

function SaveToRegistry({setStep}) {
  return (<dialog open>
    <h2>Save Public Key to Registry</h2>
    <div className="banner registry"></div>
    <p>Submit this transaction so that you can receive privately at your Ethereum address on this chain.</p>
    <div className="hr"></div>
    <div className="controls">
      <button className="button" onClick={() => setStep(0)}>
        &lt; Back
      </button>
    </div>
  </dialog>);
}
