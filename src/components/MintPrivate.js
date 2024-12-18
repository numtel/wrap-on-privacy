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
import { poseidon2 } from "poseidon-lite";
import { groth16 } from 'snarkjs';

import erc20Abi from '../abi/MockERC20.json';
import abi from '../abi/PrivateToken.json';
import {byChain, defaultChain} from '../contracts.js';
import {
  elgamalDecrypt,
  elgamalDecode,
  poseidonDecrypt,
  genTree,
  getCalldata,
  pubKey,
  randomBigInt,
} from '../utils.js';

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
  const { writeContract, isPending, isError, data, error: writeError } = useWriteContract();
  writeError && console.error(writeError);
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

  async function mint() {
    const sendNonce = randomBigInt(252);
    const input = {
      sendAmount: amount,
      sendNonce,
      recipPubKey,
    };
    const proof = await groth16.fullProve(
      input,
      '/circuits/mint/verify_circuit.wasm',
      '/circuits/mint/groth16_pkey.zkey',
    );
    const args = getCalldata(proof);

    writeContract({
      abi,
      address: byChain[defaultChain].PrivateToken,
      functionName: 'mint',
      args,

    });
    toast.dismiss();
    toast.success('Proof generated!');
    
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


