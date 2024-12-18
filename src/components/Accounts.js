import {useState, useEffect} from 'react';
import {
  useAccount,
  useWalletClient,
} from 'wagmi';
import {ArrowUpIcon} from '@heroicons/react/24/outline';

import {
  sigToKeyPair,
} from '../utils.js';
import Approve from './Approve.js';
import Transactions from './Transactions.js';
import CopyLink from './CopyLink.js';

export default function Accounts({ amount }) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [keypair, setKeypair] = useState(null);

  async function signIn() {
    const signature = await walletClient.signMessage({
      // TODO could include some more identifying info?
      message: 'Signing into my Wrap on Privacy wallet',
    });
    setKeypair(sigToKeyPair(signature));
  }

  return (<>
    {!address ? <>
      <p className="text-center p-10">Connect your wallet to begin.</p>
    </> : <>
      {!keypair ? <>
        <button
          onClick={signIn}
        >
          Sign In to Private Account
        </button>
      </> : <>
        <p>
          Public Key:
          <CopyLink text={keypair.pub.toString(16)} className="break-all" />
        </p>
        <p className="text-center bold p-6">
          <ArrowUpIcon className="h-5 w-5 inline-block" />
          This is your address to receive tokens privately
          <ArrowUpIcon className="h-5 w-5 inline-block" />
        </p>
        <Approve amount={amount} />
        <Transactions mintAmount={amount / (10n ** 16n)} privateKey={keypair.priv} publicKey={keypair.pub} />
      </>}
    </>}
  </>);
  
}
