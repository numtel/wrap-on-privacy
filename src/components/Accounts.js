import {useState, useEffect} from 'react';
import {
  useAccount,
  useWalletClient,
} from 'wagmi';

import {
  sigToKeyPair,
} from '../utils.js';
import Approve from './Approve.js';
import MintPrivate from './MintPrivate.js';

export default function Accounts() {
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
      <p>Connect your wallet to begin.</p>
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
          <span>
            {keypair.pub.toString(16)}
          </span>
        </p>
        <p>This is your address to receive tokens privately.</p>
        <Approve amount={100000n} />
        <MintPrivate amount={1000n} recipPubKey={keypair.pub} />
      </>}
    </>}
  </>);
  
}