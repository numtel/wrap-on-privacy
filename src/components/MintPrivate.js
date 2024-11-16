import {useState, useEffect} from 'react';
import {LockOpenIcon} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

import {
  useAccount,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import {formatUnits} from 'viem';

import erc20Abi from '../abi/MockERC20.json';
import abi from '../abi/PrivateToken.json';
import {byChain, defaultChain} from '../contracts.js';
import {randomBigInt} from '../utils.js';

export default function MintPrivate({ amount, recipPubKey }) {
  const { address } = useAccount();
  const { data: balanceData, isError: readError, isLoading: reading, isSuccess: readSuccess, refetch } = useReadContracts({
    contracts: [
      {
        abi: erc20Abi,
        address: byChain[defaultChain].MockERC20,
        functionName: 'balanceOf',
        args: [ address ]
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
      toast.success('Successfully entered privacy pool!');
    }
  }, [data, isPending, isError, txError, txPending, txSuccess]);

  function mint() {
    const nonce = randomBigInt(252);
    const params = {
      abi,
      address: byChain[defaultChain].PrivateToken,
      functionName: 'mint',
      args: [ amount, recipPubKey, nonce ]
    };
    writeContract(params);
    
  }
  
  return (<>
    <button
      onClick={mint}
      disabled={isPending || (balanceData && balanceData[0].result < amount)}
    >
      Wrap into privacy pool
    </button>
    {balanceData && <p className="balance">
      <LockOpenIcon className="h-5 w-5 inline-block mr-3" />
      My public balance:
      <span>{formatUnits(balanceData[0].result, 18)}</span>
    </p>}
  </>);
  
}


