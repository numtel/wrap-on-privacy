import {useState, useEffect} from 'react';

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
    <p>
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
    {filtered.map(item => <MyTx key={item.receiveNullifier} fullList={data} {...item} {...{privateKey, encryptedBalance, balanceNonce}} />)}
  </>);
}

function MyTx({ amount, receiveNullifier, privateKey, fullList, index, encryptedBalance, balanceNonce }) {
  const { data, isError, isLoading } = useReadContract({
    abi,
    address: byChain[defaultChain].PrivateToken,
    functionName: 'receivedHashes',
    args: [ receiveNullifier ],
  });
  return <p>
    {amount/100}
    {isLoading && <span>(Loading status...)</span>}
    {isError && <span>(Error loading status!)</span>}
    {typeof data === 'boolean' && !data && <span>
      (Pending)
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
    console.log(newTree);
    setTree(newTree);
  }, [ fullList, index]);

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
    console.log(input, encryptedBalance, balanceNonce);
    const proof = await groth16.fullProve(
      input,
      '/verify_circuit.wasm',
      '/groth16_pkey.zkey',
    );
    console.log(proof);
    const args = getCalldata(proof);
    console.log(args);
    console.log({
      abi,
      address: byChain[defaultChain].PrivateToken,
      functionName: 'verifyProof',
      args,

    });
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
  {!data && isPending && <p>Waiting for using to submit...</p>}
  {!data && isError && <p>Error submitting.</p>}
  {data && txError && <p>Transaction error!</p>}
  {data && txPending && <p>Waiting for tranasction...</p>}
  {data && txSuccess && <p>Transaction success!</p>}
}
