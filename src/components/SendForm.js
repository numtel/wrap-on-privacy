import {useState, useRef, useEffect} from 'react';
import { toast } from 'react-hot-toast';
import {
  useAccount,
  usePublicClient,
  useWalletClient,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from 'wagmi';
import {erc20Abi, parseUnits, isAddressEqual} from 'viem';
import { normalize } from 'viem/ens'

import scaledTokenAbi from '../abi/ScaledToken.json';
import {symmetricDecrypt} from '../utils.js';
import Dialog from './Dialog.js';
import TokenDetails from './TokenDetails.js';

// TODO batch proofs into one tx
// TODO save sends in sesh in case of decryption failure for manual note passing (or use encryption that doesn't sometimes fail?)
export default function SendForm({ pool, sesh, tokenAddr, setShowSend, showSend, setRefreshStatus }) {
  const account = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: pool.PrivateToken.chain.id });
  const registryClient = usePublicClient({ chainId: pool.KeyRegistry.chain.id });
  const ensClient = usePublicClient({ chainId: 1 });
  const walletClient = useWalletClient({ chainId: pool.PrivateToken.chain.id });
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
        chainId: pool.PrivateToken.chain.id,
        address: inputTokenAddr,
        functionName: 'balanceOf',
        args: [ account.address ]
      },
      {
        abi: erc20Abi,
        chainId: pool.PrivateToken.chain.id,
        address: inputTokenAddr,
        functionName: 'allowance',
        args: [ account.address, pool.PrivateToken.address ]
      },
      sesh ? sesh.balanceViewTx(inputTokenAddr, pool) : {},
      {
        abi: erc20Abi,
        chainId: pool.PrivateToken.chain.id,
        address: inputTokenAddr,
        functionName: 'decimals',
      },
      {
        abi: erc20Abi,
        chainId: pool.PrivateToken.chain.id,
        address: inputTokenAddr,
        functionName: 'totalSupply',
      },
      {
        abi: scaledTokenAbi,
        chainId: pool.PrivateToken.chain.id,
        address: inputTokenAddr,
        functionName: 'scaledTotalSupply',
      },
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
      toast.error(writeError.message || 'Error submitting.');
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
      setRefreshStatus(x => x+1);
    }
  }, [data, isPending, isError, txError, txPending, txSuccess]);

  async function tryProof(txFun) {
    try {
      setLoading('Generating proof...');
      const tx = await txFun();
      setLoading('Waiting for transaction...');
      writeContract(tx);
    } catch(error) {
      setLoading(null);
      console.error(error);
      toast.error(error.message || 'Error generating proof!');
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if(!balanceData) {
      toast.error('Could not load balance!');
      return;
    }
    let ensAddress;
    if(recipAddr.endsWith('.eth')) {
      ensAddress = await ensClient.getEnsAddress({
        name: normalize(recipAddr),
      });
    }
    const resolvedRecipAddr = ensAddress || recipAddr;

    if(source==='private' && recipType==='private' && isAddressEqual(resolvedRecipAddr, account.address)) {
      toast.error('Cannot send to self privately.');
      return;
    }

    if(account.chainId !== pool.PrivateToken.chain.id) {
      await switchChainAsync({ chainId: pool.PrivateToken.chain.id });
    }

    // TODO throw error if amount > 252 bits
    // TOOD support treeIndex
    const amountParsed = parseUnits(sendAmount, balanceData[3].result);
    if(source === 'public' && recipType === 'private') {
      if(amountParsed > balanceData[1].result) {
        writeContract({
          abi: erc20Abi,
          chainId: pool.PrivateToken.chain.id,
          address: inputTokenAddr,
          functionName: 'approve',
          args: [ pool.PrivateToken.address, amountParsed ]
        });
        return;
      }
      // mint into pool
      await tryProof(() => sesh.sendPrivateTx(
        amountParsed,
        BigInt(inputTokenAddr),
        pool,
        publicClient,
        registryClient,
        resolvedRecipAddr,
        1, // publicMode=mint
      ));
    } else if(source === 'public' && recipType === 'public') {
      // standard erc20 transfer
      setLoading('Waiting for transaction...');
      writeContract({
        abi: erc20Abi,
        chainId: pool.PrivateToken.chain.id,
        address: inputTokenAddr,
        functionName: 'transfer',
        args: [ resolvedRecipAddr, amountParsed ]
      });
    } else if(source === 'private' && recipType === 'private') {
      // private transfer
      await tryProof(() => sesh.sendPrivateTx(
        amountParsed,
        BigInt(inputTokenAddr),
        pool,
        publicClient,
        registryClient,
        resolvedRecipAddr,
        0, // publicMode=none
      ));
    } else if(source === 'private' && recipType === 'public') {
      // burn from pool
      await tryProof(() => sesh.sendPrivateTx(
        amountParsed,
        BigInt(inputTokenAddr),
        pool,
        publicClient,
        registryClient,
        resolvedRecipAddr,
        2, // publicMode=burn
      ));
    }
  }

  function sendToSelf() {
    account && setRecipAddr(account.address);
  }

  function sendMax(event) {
    const text = event.target.innerHTML;
    const max = parseFloat(text.split(' ')[0]);
    if(!isNaN(max)) setSendAmount(String(max));
  }

  let privateBalance = 0, publicBalance = 0, amountParsed = 0;
  if(balanceData) {
    amountParsed = parseUnits(sendAmount, balanceData[3].result)
      * (balanceData[5].result ? balanceData[5].result : 1n)
      / (balanceData[5].result ? balanceData[4].result : 1n);
    publicBalance = balanceData[0].result;
    if(balanceData[2].result) {
      privateBalance = balanceData[2].result[0] === 0n ? 0n : symmetricDecrypt(
        balanceData[2].result[0],
        sesh.balanceKeypair().privateKey,
        balanceData[2].result[1]
      );
    }
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
          <p><TokenDetails address={inputTokenAddr} {...{pool}} /></p>
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
            <input ref={primaryInputRef} name="sendAmount" type="number" value={sendAmount} onChange={e => setSendAmount(e.target.value)} />
          </label>
          {balanceData && <p>Max: <button type="button" className="link" onClick={sendMax}><TokenDetails maybeScaled={source === 'private'} address={inputTokenAddr} {...{pool}} amount={source === 'private' ? privateBalance : publicBalance} /></button></p>}
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
            <input name="recipAddr" value={recipAddr} onChange={e => setRecipAddr(e.target.value)} />
          </label>
          <p><button className="link" type="button" onClick={sendToSelf} disabled={recipType==='private' && source==='private'}>
            Send to Self
          </button></p>
        </fieldset>
      </div>
      <div className="controls">
        <button disabled={isPending || (data && txPending) || !!loading || !balanceData || (source === 'public' && publicBalance < amountParsed)|| (source === 'private' && privateBalance < amountParsed)} className="button" type="submit">
          {loading || (source === 'public' && recipType === 'private' && balanceData && amountParsed > balanceData[1].result ? 'Approve' : 'Send')}
        </button>
      </div>
    </form>
  </Dialog>);
}
