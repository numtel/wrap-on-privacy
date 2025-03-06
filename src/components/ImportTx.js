import {useState, useEffect} from 'react';
import { toast } from 'react-hot-toast';
import {
  useAccount,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from 'wagmi';

import Dialog from './Dialog.js';
import TokenDetails from './TokenDetails.js';
import {AlreadySubmitted} from './IncomingTable.js';

export default function ImportTx({importTx, setImportTx, pool, setRefreshStatus, sesh}) {
  const account = useAccount();
  const [loading, setLoading] = useState(null);
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: pool.PrivateToken.chain.id });
  const { writeContract, isPending, isError, data, error: writeError } = useWriteContract();
  const { isError: txError, isPending: txPending, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: data });

  useEffect(() => {
    toast.dismiss();
    if(!data && isPending) {
      toast.loading('Waiting for user to submit...');
    } else if(!data && isError) {
      console.error(writeError);
      toast.error(writeError.message || 'Error submitting.');
      setLoading(null);
    } else if(data && txError) {
      toast.error('Transaction error!');
      setLoading(null);
    } else if(data && txPending) {
      toast.loading('Waiting for transaction...');
    } else if(data && txSuccess) {
      toast.success('Transaction Successful!');
      setLoading(null);
      setImportTx(false);
      setRefreshStatus(x => x+1);
    }
  }, [data, isPending, isError, txError, txPending, txSuccess]);

  async function submit() {
    setLoading(true);
    // TODO: support treeIndex
    const treeIndex = 0;
    toast.loading('Generating Proof...');
    const tx = await sesh.receiveTx(pool, treeIndex, importTx.incoming, publicClient, publicClient);
    toast.dismiss();

    if(account.chainId !== pool.PrivateToken.chain.id) {
      await switchChainAsync({ chainId: pool.PrivateToken.chain.id });
    }
    writeContract(tx);
  }

  return (
    <Dialog title="Import Transaction" show={!!importTx} setShow={setImportTx}>
      <AlreadySubmitted
        {...{sesh, pool}}
        client={publicClient}
        newItem={importTx.incoming}
        ifNot={<>
          <p>
            Are you sure you wish to privately accept&nbsp;
            <TokenDetails
              address={importTx.incoming.tokenAddr}
              {...{pool}}
              maybeScaled={true}
              amount={BigInt(importTx.incoming.sendAmount)}
              linkSymbol={true}
            />
            ?
          </p>
          <div className="flex flex-row justify-center space-x-4">
            <button disabled={loading} className="button" onClick={submit}>
              Ok
            </button>
            <button className="button" onClick={() => setImportTx(false)}>
              Cancel
            </button>
          </div>
        </>}
        ifSubmitted={<>
          <p>This transaction has already been accepted!</p>
          <div className="flex flex-row justify-center space-x-4">
            <button className="button" onClick={() => setImportTx(false)}>
              Close
            </button>
          </div>
        </>}
      />
    </Dialog>
  );
}
