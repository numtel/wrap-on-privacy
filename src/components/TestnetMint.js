import {useState, useEffect} from 'react';
import { toast } from 'react-hot-toast';

import {
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';

import abi from '../abi/MockERC20.json';
import {byChain, defaultChain} from '../contracts.js';

export default function TestnetMint({ amount }) {
  const { writeContract, isPending, isError, data } = useWriteContract();
  const { isError: txError, isPending: txPending, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: data });

  function mint() {
    writeContract({
      abi,
      address: byChain[defaultChain].MockERC20,
      functionName: 'mint',
      args: [ amount ]
    });
    
  }

  useEffect(() => {
    toast.dismiss();
    if(!data && isPending) {
      toast.loading('Waiting for user to submit...');
    } else if(!data && isError) {
      toast.error('Error submitting.');
    } else if(data && txError) {
      toast.error('Transaction error!');
    } else if(data && txPending) {
      toast.loading('Waiting for transaction...');
    } else if(data && txSuccess) {
      toast.success('Testnet public tokens minted!');
    }
  }, [data, isPending, isError, txError, txPending, txSuccess]);

  return (<>
    <button
      id="testnet-mint"
      onClick={mint}
      disabled={isPending}
    >
      Mint public ERC20 tokens for testing
    </button>
  </>);
  
}
