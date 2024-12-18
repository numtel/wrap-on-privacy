import {useState, useEffect} from 'react';
import { toast } from 'react-hot-toast';
import { poseidon2 } from "poseidon-lite";
import { groth16 } from 'snarkjs';

import {
  useAccount,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';

import abi from '../abi/PrivateToken.json';
import {byChain, defaultChain} from '../contracts.js';
import {
  elgamalDecrypt,
  elgamalDecode,
  elgamalEncrypt,
  poseidonDecrypt,
  genTree,
  getCalldata,
  pubKey,
  randomBigInt,
} from '../utils.js';

export default function BurnPrivate({fullList, privateKey, encryptedBalance, balanceNonce}) {
  const { address } = useAccount();
  const [amount, setAmount] = useState(1);
  const { writeContract, isPending, isError, data } = useWriteContract();
  const { isError: txError, isPending: txPending, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: data });

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
      toast.success('Successfully withdrew from privacy pool!');
    }
  }, [data, isPending, isError, txError, txPending, txSuccess]);

  async function handleSubmit(event) {
    event.preventDefault();
    toast.loading('Generating proof...');
    const newBalanceNonce = randomBigInt(252);
    const sendNonce = randomBigInt(252);
    const fakeReceiptNonce = randomBigInt(252);
    const tree = genTree(fullList.map(x => poseidon2([x.result[0], x.result[1]])), 0);
    const decodedAmountReceived = 123n; // not used
    const fakeReceipt = elgamalEncrypt(decodedAmountReceived, pubKey(privateKey), fakeReceiptNonce);
    const input = {
      encryptedAmountReceived: fakeReceipt.encryptedMessage,
      ephemeralKeyReceived: fakeReceipt.ephemeralKey,
      decodedAmountReceived,
      treeDepth: tree.treeDepth,
      treeIndices: tree.treeIndices,
      treeSiblings: tree.treeSiblings,
      privateKey,
      encryptedBalance,
      balanceNonce,
      newBalanceNonce,
      sendAmount: BigInt(amount * 100),
      sendNonce,
      recipPubKey: address,
      isBurn: 1,
      isReceiving: 0,
      nonReceivingTreeRoot: tree.treeRoot,
    };
    console.log(input);
    const proof = await groth16.fullProve(
      input,
      '/circuits/main/verify_circuit.wasm',
      '/circuits/main/groth16_pkey.zkey',
    );
    console.log(proof);
    const args = getCalldata(proof);
    console.log(args);
    writeContract({
      abi,
      address: byChain[defaultChain].PrivateToken,
      functionName: 'verifyProof',
      args,

    });
    toast.dismiss();
    toast.success('Proof generated!');
  }

  return <form onSubmit={handleSubmit}>
    <fieldset>
      <legend>Withdraw from Private Pool</legend>
      <label>
        <span>Amount:</span>
        <input
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          min="0"
          max="5242.88"
          step="0.01"
          type="number"
        />
      </label>
      <button
        type="submit"
      >
        Submit
      </button>
    </fieldset>
  </form>;
}
