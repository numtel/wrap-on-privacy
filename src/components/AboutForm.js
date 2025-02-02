import { useAccount, useReadContracts } from 'wagmi';
import { erc20Abi } from 'viem';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub, faEthereum } from '@fortawesome/free-brands-svg-icons';

import {byChain, defaultChain} from '../contracts.js';
import abi from '../abi/PrivateToken.json';

import Dialog from './Dialog.js';

export default function AboutForm({ setShowAbout, showAbout }) {
  const account = useAccount();
  let chainId = account.chainId || defaultChain;
  if(!(chainId in byChain)) chainId = defaultChain;
  const { data, isError, isLoading, refetch } = useReadContracts({contracts: [
    {
      address: byChain[chainId].PrivateToken,
      abi,
      chainId,
      functionName: 'verifier',
    },
  ], watch:false});

  return (<Dialog show={showAbout} setShow={setShowAbout}>
    <h2>About Wrap on Privacy</h2>
    <div className="banner about" />
    <div className="flex justify-between flex-col sm:flex-row space-y-4 sm:space-y-0">
      <a href="https://github.com/numtel/wrap-on-privacy" className="link" rel="noopener" target="_blank">
        <FontAwesomeIcon icon={faGithub} size="2xl" />
        View Project on Github
      </a>
      <a href={`${byChain[chainId].explorer}${byChain[chainId].PrivateToken}`} className="link" rel="noopener" target="_blank">
        <FontAwesomeIcon icon={faEthereum} size="2xl" />
        View Main Contract on Etherscan
      </a>
    </div>
    {data && <div className="flex items-center flex-col space-y-2 mt-4">
      <a href={`https://circuitscan.org/chain/${chainId}/address/${data[0].result}`} className="link" rel="noopener" target="_blank">
        Verifier on Circuitscan
      </a>
    </div>}
  </Dialog>);
}
