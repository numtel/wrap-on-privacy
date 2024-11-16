import {
  ConnectButton,
} from '@rainbow-me/rainbowkit';
import { Toaster } from 'react-hot-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub, faEthereum } from '@fortawesome/free-brands-svg-icons';

import WalletWrapper from "./components/WalletWrapper.js";
import Accounts from "./components/Accounts.js";
import TestnetMint from "./components/TestnetMint.js";

const TEST_AMOUNT = 1000n * (10n ** 18n);

export function App() {
  return (<>
    <WalletWrapper>
      <Toaster />
      <div className="text-center">
        <img src="/wrap-on-privacy.png" className="inline-block" alt="Wrap on Privacy Logo" />
        <br />
        <span id="site-title" className="text-7xl mb-8">
          Wrap on Privacy
        </span>
      </div>
      <div id="connect">
        <ConnectButton />
      </div>
      <TestnetMint amount={TEST_AMOUNT} />
      <Accounts amount={TEST_AMOUNT} />
      <footer>
        <a href="https://github.com/numtel/wrap-on-privacy" rel="noopener" target="_blank" title="Github Repository">
          <FontAwesomeIcon icon={faGithub} size="2xl" />
        </a>&nbsp;
        <a href="https://ethglobal.com/showcase/wrap-on-privacy-ryuw6" rel="noopener" target="_blank" title="ETHGlobal Bangkok Hackathon">
          <FontAwesomeIcon icon={faEthereum} size="2xl" />
        </a>
      </footer>
    </WalletWrapper>
  </>);
}
