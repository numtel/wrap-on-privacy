
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

  return (<>
    <button
      onClick={mint}
      disabled={isPending}
    >
      Mint public ERC20 tokens for testing
    </button>
    {!data && isPending && <p>Waiting for using to submit...</p>}
    {!data && isError && <p>Error submitting.</p>}
    {data && txError && <p>Transaction error!</p>}
    {data && txPending && <p>Waiting for tranasction...</p>}
    {data && txSuccess && <p>Transaction success!</p>}
  </>);
  
}
