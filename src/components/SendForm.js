import {useState, useRef, useEffect} from 'react';
import { toast } from 'react-hot-toast';
import {
  useAccount,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';

import Dialog from './Dialog.js';

export default function SendForm({ sesh, tokenAddr, chainId, setShowSend, showSend }) {
  const account = useAccount();
  const [loading, setLoading] = useState(null);
  const [sendAmount, setSendAmount] = useState('0');
  const [recipAddr, setRecipAddr] = useState('');
  const [source, setSource] = useState('private');
  const [recipType, setRecipType] = useState('private');
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
      toast.success('Transfer Successful!');
      setLoading(null);
    }
  }, [data, isPending, isError, txError, txPending, txSuccess]);

  async function handleSubmit(event) {
    event.preventDefault();
    if(source === 'public' && recipType === 'private') {
      setLoading('Generating proof...');
      // mint into pool
      const tx = await sesh.mintTx(BigInt(sendAmount), BigInt(tokenAddr), BigInt(chainId));
      console.log(tx);
      setLoading('Waiting for transaction...');
      writeContract(tx);

    } else if(source === 'public' && recipType === 'public') {
      // standard erc20 transfer
    } else if(source === 'private' && recipType === 'private') {
      // private transfer
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
      <div className="flex flex-col mb-4 sm:flex-row sm:space-x-4 justify-evenly sm:space-y-0 space-y-4">
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
          <button className="link" type="button" onClick={sendToSelf}>
            Send to Self
          </button>
        </fieldset>
      </div>
      <div className="controls">
        <button disabled={!!loading} className="button" type="submit">
          {loading || 'Send'}
        </button>
      </div>
    </form>
  </Dialog>);
}
