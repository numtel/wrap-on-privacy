import {useState, useEffect} from 'react';
import {LockClosedIcon} from '@heroicons/react/24/outline';

import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { poseidon2 } from "poseidon-lite";
import { toast } from 'react-hot-toast';
import { groth16 } from 'snarkjs';

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
import SendPrivate from './SendPrivate.js';
import BurnPrivate from './BurnPrivate.js';

export default function Transactions({ privateKey }) {
  const [myTx, setMyTx] = useState([]);
  const { data, isError, isLoading } = useReadContracts({
    contracts: [
      {
        abi,
        address: byChain[defaultChain].PrivateToken,
        functionName: 'sendCount',
      },
      {
        abi,
        address: byChain[defaultChain].PrivateToken,
        functionName: 'accounts',
        args: [pubKey(privateKey)],
      },
    ]
  });
  if(isError) return <p>Error loading send count!</p>;
  if(isLoading) return <p>Loading send count...</p>;
  const balance = poseidonDecrypt(privateKey, data[1].result[1], data[1].result[0]);
  return <>
    <p className="balance">
      <LockClosedIcon className="h-5 w-5 inline-block mr-3" />
      My private balance:
      <span>{(balance / 100n).toString()}</span>
    </p>
    <FindMyTx {...{privateKey}} encryptedBalance={data[1].result[0]} balanceNonce={data[1].result[1]} sendCount={Number(data[0].result)} />
  </>;
}

function FindMyTx({ sendCount, privateKey, encryptedBalance, balanceNonce }) {
  const [filtered, setFiltered] = useState([]);
  // XXX fine for small pools
  const { data, isError, isLoading } = useReadContracts({
    contracts: Array(sendCount).fill(1).map((_, i) => ({
      abi,
      address: byChain[defaultChain].PrivateToken,
      functionName: 'encryptedSends',
      args: [ i ],
    })),
  });

  useEffect(() => {
    if(data) {
      const newFiltered = [];
      for(let i = 0; i < data.length; i++) {
        const decrypted = elgamalDecrypt(privateKey, data[i].result[1], data[i].result[0]);
        const decoded = elgamalDecode(decrypted);
        if(decoded) {
          newFiltered.push({
            index: i,
            amount: decoded,
            receiveNullifier: poseidon2([poseidon2([data[i].result[0], data[i].result[1]]), privateKey]),
          });
        }
      }
      setFiltered(newFiltered);
    }
  }, [ data ]);

  if(isError) return <p>Error loading send amounts!</p>;
  if(isLoading) return <p>Loading send amounts...</p>;

  return (<>
    <SendPrivate fullList={data} {...{privateKey, encryptedBalance, balanceNonce}} />
    <BurnPrivate fullList={data} {...{privateKey, encryptedBalance, balanceNonce}} />
    <h2>Incoming Transactions</h2>
    <ul className="incoming">
    {filtered.map(item => <li key={item.receiveNullifier}><MyTx fullList={data} {...item} {...{privateKey, encryptedBalance, balanceNonce}} /></li>)}
    </ul>
  </>);
}

function MyTx({ amount, receiveNullifier, privateKey, fullList, index, encryptedBalance, balanceNonce }) {
  const { data, isError, isLoading } = useReadContract({
    abi,
    address: byChain[defaultChain].PrivateToken,
    functionName: 'receivedHashes',
    args: [ receiveNullifier ],
  });
  return <p className={(typeof data === 'boolean' && !data) ? 'pending' : 'accepted'}>
    <span className="amount">{amount/100}</span>&nbsp;
    {isLoading && <span>(Loading status...)</span>}
    {isError && <span>(Error loading status!)</span>}
    {typeof data === 'boolean' && !data && <span class="controls">
      <ReceiveTx {...{amount, receiveNullifier, privateKey, fullList, index, encryptedBalance, balanceNonce}} />
    </span>}
  </p>;
}

function ReceiveTx({ amount, receiveNullifier, privateKey, fullList, index, encryptedBalance, balanceNonce }) {
  const [tree, setTree] = useState(null);
  const { writeContract, isPending, isError, data } = useWriteContract();
  const { isError: txError, isPending: txPending, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: data });
  useEffect(() => {
    const newTree = genTree(fullList.map(x => poseidon2([x.result[0], x.result[1]])), index);
    setTree(newTree);
  }, [ fullList, index]);

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
      toast.success('Transaction accepted!');
    }
  }, [data, isPending, isError, txError, txPending, txSuccess]);

  async function acceptTx() {
    toast.loading('Generating proof...');
    const firstBalanceNonce = randomBigInt(252);
    const newBalanceNonce = randomBigInt(252);
    const sendNonce = randomBigInt(252);
    const input = {
      encryptedAmountReceived: fullList[index].result[0],
      ephemeralKeyReceived: fullList[index].result[1],
      decodedAmountReceived: amount,
      treeDepth: tree.treeDepth,
      treeIndices: tree.treeIndices,
      treeSiblings: tree.treeSiblings,
      privateKey,
      encryptedBalance: encryptedBalance === 0n ? poseidon2([ privateKey, firstBalanceNonce ]) : encryptedBalance,
      balanceNonce: balanceNonce === 0n ? firstBalanceNonce : balanceNonce,
      newBalanceNonce,
      sendAmount: 0,
      sendNonce,
      recipPubKey: pubKey(privateKey) - 1n, // black hole
      isBurn: 0,
      isReceiving: 1,
      // This value will not be output in this test case because it is receiving
      nonReceivingTreeRoot: 0n,
    };
    const proof = await groth16.fullProve(
      input,
      '/verify_circuit.wasm',
      '/groth16_pkey.zkey',
    );
    const args = getCalldata(proof);
    writeContract({
      abi,
      address: byChain[defaultChain].PrivateToken,
      functionName: 'verifyProof',
      args,

    });
    toast.dismiss();
    toast.success('Proof generated!');

  }

  return <button
    onClick={acceptTx}
  >
    Accept Incoming Tx
  </button>
}
