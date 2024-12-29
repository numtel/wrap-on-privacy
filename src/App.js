import {useState, useEffect} from 'react';
import {
  ConnectButton,
} from '@rainbow-me/rainbowkit';
import { Toaster } from 'react-hot-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub, faEthereum } from '@fortawesome/free-brands-svg-icons';

import WalletWrapper from "./components/WalletWrapper.js";
import SetupWizard from './components/SetupWizard.js';
import SendForm from './components/SendForm.js';

export function App() {
  const [sesh, setSesh] = useState(null);
  return (<>
    <WalletWrapper>
      <Toaster />
      <div id="connect">
        <ConnectButton />
      </div>
      {!sesh && <SetupWizard {...{sesh, setSesh}} />}
      {/*<SendForm {...{sesh}} tokenAddr={testTokenAddr} chainId={11155111} />*/}
    </WalletWrapper>
  </>);
}
