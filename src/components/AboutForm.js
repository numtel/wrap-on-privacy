import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub, faEthereum } from '@fortawesome/free-brands-svg-icons';
import Dialog from './Dialog.js';

export default function AboutForm({ pool, setShowAbout, showAbout }) {
  return (<Dialog title="About Wrap on Privacy" show={showAbout} setShow={setShowAbout}>
    <div className="flex flex-col space-y-4">
      <div className="banner about" />
      <a href="https://github.com/numtel/wrap-on-privacy" className="link" rel="noopener" target="_blank">
        <FontAwesomeIcon icon={faGithub} size="2xl" />
        View Project on Github
      </a>
    </div>
  </Dialog>);
}
