import {
  ConnectButton,
} from '@rainbow-me/rainbowkit';
import { Toaster } from 'react-hot-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub, faEthereum } from '@fortawesome/free-brands-svg-icons';

import WalletWrapper from "./components/WalletWrapper.js";
import SetupWizard from './components/SetupWizard.js';
import SendForm from './components/SendForm.js';

import PrivateTokenSession from './PrivateTokenSession.js';

window.sesh = new PrivateTokenSession;

const testTokenAddr = '0x2C35714C1dF8069856E41e7b75B2270929b6459c';
const TEST_AMOUNT = 1000n * (10n ** 18n);

export function App() {
  return (<>
    <WalletWrapper>
      <Toaster />
      <div id="connect">
        <ConnectButton />
      </div>
      <SetupWizard {...{sesh}} />
      {/*<SendForm {...{sesh}} tokenAddr={testTokenAddr} chainId={11155111} />*/}
    </WalletWrapper>
  </>);
}
