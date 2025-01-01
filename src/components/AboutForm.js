import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub, faEthereum } from '@fortawesome/free-brands-svg-icons';


import Dialog from './Dialog.js';

export default function AboutForm({ setShowAbout, showAbout }) {
  return (<Dialog show={showAbout} setShow={setShowAbout}>
    <h2>About Wrap on Privacy</h2>
    <div className="banner about" />
    <div className="flex justify-between flex-col sm:flex-row space-y-4 sm:space-y-0">
      <a href="https://github.com/numtel/wrap-on-privacy" className="link" rel="noopener" target="_blank">
        <FontAwesomeIcon icon={faGithub} size="2xl" />
        View Project on Github
      </a>
      <a href="https://sepolia.etherscan.io/address/0xd812358866b1b6a71eae3f38b5cfd72c1ba8ca3" className="link" rel="noopener" target="_blank">
        <FontAwesomeIcon icon={faEthereum} size="2xl" />
        View Main Contract on Etherscan
      </a>
    </div>
  </Dialog>);
}
