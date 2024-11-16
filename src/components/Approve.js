import {useState, useEffect} from 'react';

import {
  useAccount,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';

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
    {approveData && <p>My approval amount: <span>{approveData[0].result.toString()}</span></p>}
    {!data && isPending && <p>Waiting for using to submit...</p>}
    {!data && isError && <p>Error submitting.</p>}
    {data && txError && <p>Transaction error!</p>}
    {data && txPending && <p>Waiting for tranasction...</p>}
    {data && txSuccess && <p>Transaction success!</p>}
  </>);
  
}

