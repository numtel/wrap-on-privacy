import {useState, useRef, useEffect} from 'react';
import { toast } from 'react-hot-toast';
import {
  useAccount,
  usePublicClient,
  useWalletClient,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import {erc20Abi} from 'viem';

import {byChain, defaultChain} from '../contracts.js';
import Dialog from './Dialog.js';
import TokenDetails from './TokenDetails.js';

export default function SendForm({ sesh, tokenAddr, chainId, setShowSend, showSend }) {
  const account = useAccount();
  const publicClient = usePublicClient({ chainId });
  const walletClient = useWalletClient({ chainId });
  const [loading, setLoading] = useState(null);
  const [sendAmount, setSendAmount] = useState('0');
  const [recipAddr, setRecipAddr] = useState('');
  const [inputTokenAddr, setInputTokenAddr] = useState(tokenAddr);
  const [source, setSource] = useState('private');
  const [recipType, setRecipType] = useState('private');
  const { data: balanceData, isError: readError, isLoading: reading, isSuccess: readSuccess, refetch } = useReadContracts({
    contracts: [
      {
        abi: erc20Abi,
        chainId,
        address: inputTokenAddr,
        functionName: 'balanceOf',
        args: [ account.address ]
      },
      {
        abi: erc20Abi,
        chainId,
        address: inputTokenAddr,
        functionName: 'allowance',
        args: [ account.address, byChain[defaultChain].PrivateToken ]
      },
      sesh.balanceViewTx(inputTokenAddr, chainId),
    ],
  });
  const { writeContract, isPending, isError, data, error: writeError } = useWriteContract();
  const { isError: txError, isPending: txPending, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: data });
  const primaryInputRef = useRef(null);

  useEffect(() => {
    toast.dismiss();
    if(!data && isPending) {
      toast.loading('Waiting for user to submit...');
    } else if(!data && isError) {
      console.error(writeError);
      toast.error('Error submitting.');
      setLoading(null);
    } else if(data && txError) {
      toast.error('Transaction error!');
      setLoading(null);
    } else if(data && txPending) {
      toast.loading('Waiting for transaction...');
    } else if(data && txSuccess) {
      toast.success('Transaction Successful!');
      refetch();
      setLoading(null);
    }
  }, [data, isPending, isError, txError, txPending, txSuccess]);

  async function handleSubmit(event) {
    event.preventDefault();
    if(source === 'public' && recipType === 'private') {
      if(sendAmount > balanceData[1].result) {
        writeContract({
          abi: erc20Abi,
          chainId,
          address: inputTokenAddr,
          functionName: 'approve',
          args: [ byChain[defaultChain].PrivateToken, sendAmount ]
        });
        return;
      }
      setLoading('Generating proof...');
      // mint into pool
      try {
        const tx = await sesh.mintTx(BigInt(sendAmount), BigInt(inputTokenAddr), BigInt(chainId), publicClient, recipAddr);
        setLoading('Waiting for transaction...');
        writeContract(tx);
      } catch(error) {
        setLoading(null);
        console.error(error);
        toast.error('Error generating proof!');
      }

    } else if(source === 'public' && recipType === 'public') {
      // standard erc20 transfer
    } else if(source === 'private' && recipType === 'private') {
      // private transfer
      setLoading('Generating proof...');
      // mint into pool
      try {
        const tx = await sesh.sendPrivateTx(BigInt(sendAmount), inputTokenAddr, chainId, publicClient, recipAddr);
        setLoading('Waiting for transaction...');
        writeContract(tx);
      } catch(error) {
        setLoading(null);
        console.error(error);
        toast.error('Error generating proof!');
      }
    } else if(source === 'private' && recipType === 'public') {
      // burn from pool
    }
  }

  function sendToSelf() {
    account && setRecipAddr(account.address);
  }

  return (<Dialog show={showSend} setShow={setShowSend}>
    <h2>Transfer Tokens</h2>
    <form onSubmit={handleSubmit}>
      <div className="flex flex-col mb-4  space-y-4">
        <fieldset>
          <legend>Token</legend>
          <label className="text">
            <span>Address:</span>
            <input name="tokenAddr" value={inputTokenAddr} onChange={e => setInputTokenAddr(e.target.value)} />
          </label>
          <p><TokenDetails address={inputTokenAddr} {...{chainId}} /></p>
        </fieldset>
        <fieldset>
          <legend>Source</legend>
          <label className="radio">
            <input type="radio" name="source" value="public" checked={source==='public'} onChange={e => setSource(e.target.value)} />
            <span>Public Balance</span>
          </label>
          <label className="radio">
            <input type="radio" name="source" value="private" checked={source==='private'} onChange={e => setSource(e.target.value)} />
            <span>Private Balance</span>
          </label>
          <label className="text">
            <span>Amount:</span>
            <input ref={primaryInputRef} name="sendAmount" type="number" min="0" value={sendAmount} onChange={e => setSendAmount(e.target.value)} />
          </label>
          <p>Max: {balanceData ? source === 'public' ? balanceData[0].result.toString() : 'xxx' : 'Loading...'}</p>
        </fieldset>
        <fieldset>
          <legend>Recipient</legend>
          <label className="radio">
            <input type="radio" name="recipType" value="public" checked={recipType==='public'} onChange={e => setRecipType(e.target.value)} />
            <span>Public</span>
          </label>
          <label className="radio">
            <input type="radio" name="recipType" value="private" checked={recipType==='private'} onChange={e => setRecipType(e.target.value)} />
            <span>Private</span>
          </label>
          <label className="text">
            <span>Address or ENS name:</span>
            <input name="recipAddr" value={recipAddr} onChange={e => setReciptAddr(e)} />
          </label>
          <p><button className="link" type="button" onClick={sendToSelf}>
            Send to Self
          </button></p>
        </fieldset>
      </div>
      <div className="controls">
        <button disabled={isPending || (data && txPending) || !!loading || !balanceData || (source === 'public' && balanceData[0].result < sendAmount) /*|| (source === 'private')*/} className="button" type="submit">
          {loading || (source === 'public' && balanceData && sendAmount > balanceData[1].result ? 'Approve' : 'Send')}
        </button>
      </div>
    </form>
  </Dialog>);
}
