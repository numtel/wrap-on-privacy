import {useState, useEffect} from 'react';
import { toast } from 'react-hot-toast';
import {PaperAirplaneIcon} from '@heroicons/react/24/outline';

import {
  useAccount,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import {formatUnits} from 'viem';

import abi from '../abi/MockERC20.json';
import {byChain, defaultChain} from '../contracts.js';

export default function Approve({ amount }) {
  const { address } = useAccount();
  const { data: approveData, isError: readError, isLoading: reading, isSuccess: readSuccess, refetch } = useReadContracts({
    contracts: [
      {
        abi,
        address: byChain[defaultChain].MockERC20,
        functionName: 'allowance',
        args: [ address, byChain[defaultChain].PrivateToken ]
      },
    ],
  });
  const { writeContract, isPending, isError, data } = useWriteContract();
  const { isError: txError, isPending: txPending, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: data });
  useEffect(() => {
    txSuccess && refetch();
  }, [ txSuccess ]);

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
      toast.success('Testnet public allowance set!');
    }
  }, [data, isPending, isError, txError, txPending, txSuccess]);

  function approve() {
    writeContract({
      abi,
      address: byChain[defaultChain].MockERC20,
      functionName: 'approve',
      args: [ byChain[defaultChain].PrivateToken, amount ]
    });
    
  }
  
  return (<>
    <button
      onClick={approve}
      disabled={isPending || (approveData && approveData[0].result >= amount)}
    >
      Approve
    </button>
    {approveData && <p className="balance">
      <PaperAirplaneIcon className="h-5 w-5 inline-block mr-3" />
      My approval amount: <span>{formatUnits(approveData[0].result, 18)}</span></p>}
  </>);
  
}

