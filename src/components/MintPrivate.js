import {useState, useEffect} from 'react';

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
    {balanceData && <p>
      My public balance:
      <span>{formatUnits(balanceData[0].result, 18)}</span>
    </p>}
    {!data && isPending && <p>Waiting for using to submit...</p>}
    {!data && isError && <p>Error submitting.</p>}
    {data && txError && <p>Transaction error!</p>}
    {data && txPending && <p>Waiting for tranasction...</p>}
    {data && txSuccess && <p>Transaction success!</p>}
  </>);
  
}


