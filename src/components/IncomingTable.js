import {useState, useEffect} from 'react';
import { toast } from 'react-hot-toast';

import {
  useAccount,
  useReadContracts,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';

import GenericSortableTable from './SortableTable.js';
import TokenDetails from './TokenDetails.js';
import TimeView from './TimeView.js';
import abi from '../abi/PrivateToken.json';
import {byChain, defaultChain} from '../contracts.js';

// TODO proper support for treeIndex on scanForIncoming
export default function LoadIncoming({ sesh, activePool, refreshCounter }) {
  const treeIndex = 0;
  const account = useAccount();
  const chainId = account.chainId || defaultChain;
  const publicClient = usePublicClient({ chainId });
  const [contracts, setContracts] = useState([]);
  const { data, isError, isLoading, isSuccess, refetch } = useReadContracts({contracts, watch: false });
  const [cleanDataUpdate, setCleanData] = useState([]);
  const { writeContract, isPending, isError: isWriteError, data: writeData, error: writeError } = useWriteContract();
  const { isError: txError, isPending: txPending, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: data });

  useEffect(() => {
    async function doAsync() {
      const params = await sesh.scanForIncoming(publicClient, treeIndex, chainId);
      const contracts = new Array(params.count - params.oldCount).fill(0).map((_, i) => [
        {
          abi,
          chainId,
          address: byChain[chainId].PrivateToken,
          functionName: 'encryptedSends',
          args: [ treeIndex, i + params.oldCount ],
        },
        {
          abi,
          chainId,
          address: byChain[chainId].PrivateToken,
          functionName: 'sendTimes',
          args: [ treeIndex, i + params.oldCount ],
        },
        {
          abi,
          chainId,
          address: byChain[chainId].PrivateToken,
          functionName: 'sendAccounts',
          args: [ treeIndex, i + params.oldCount ],
        },
        {
          abi,
          chainId,
          address: byChain[chainId].PrivateToken,
          functionName: 'sendHashes',
          args: [ treeIndex, i + params.oldCount ],
        },
      ]).flat();
      setContracts(contracts);
    }
    sesh && doAsync();
  }, [refreshCounter, treeIndex]);

  useEffect(() => {
    if(isSuccess) {
      const cleanData = [];
      let lastIndex = -1;
      for(let i = 0; i < data.length; i+=4) {
        // TODO have to refresh page if changing accounts
        const decrypted = sesh.decryptIncoming(data[i].result, chainId);
        const index = i/3 + contracts[0].args[1];
        lastIndex = index;
        if(decrypted && decrypted.hash === data[i+3].result) {
          cleanData.push({
            index,
            receiveTxHash: data[i+3].result.toString(10),
            sendAmount: decrypted.sendAmount.toString(10),
            sendBlinding: decrypted.sendBlinding.toString(10),
            tokenAddr: '0x' + decrypted.tokenAddr.toString(16),
            time: Number(data[i+1].result),
            sender: data[i+2].result,
          });
        } else {
          // Save space on the tree leaves that aren't for this account
          cleanData.push({
            index,
            receiveTxHash: data[i+3].result.toString(10),
          });
        }
      }
      sesh.setLastScanned(treeIndex, chainId, lastIndex + 1, cleanData);
      setCleanData(cleanData);
    }
  }, [isSuccess]);

  useEffect(() => {
    toast.dismiss();
    if(!writeData && isPending) {
      toast.loading('Waiting for user to submit...');
    } else if(!writeData && isWriteError) {
      console.error(writeError);
      const knownError = writeError.message.match(/PrivateToken__([a-zA-z0-9]+)/);
      if(knownError && knownError[1] === 'DuplicateNullifier') {
        toast.error('Incoming transaction already accepted.')
      } else if(knownError) {
        toast.error(knownError[1]); 
      } else {
        toast.error('Error submitting.');
      }
    } else if(writeData && txError) {
      toast.error('Transaction error!');
    } else if(writeData && txPending) {
      toast.loading('Waiting for transaction...');
    } else if(writeData && txSuccess) {
      toast.success('Transaction Successful!');
    }
  }, [writeData, isPending, isError, txError, txPending, txSuccess]);

  async function acceptIncoming(item) {
    toast.loading('Generating proof...');
    const tx = await sesh.receiveTx(chainId, treeIndex, item, publicClient);
    toast.dismiss();
    toast.loading('Waiting for transaction...');
    writeContract(tx);
  }

  console.log(sesh);
  if(sesh && (chainId in sesh.incoming) && (treeIndex in sesh.incoming[chainId])) return (
    <GenericSortableTable
      columns={[
        {key:'index', label: 'Index'},
        {key:'decrypted', label: 'Incoming Amount', render: (item) => (
          <button onClick={() => acceptIncoming(item)} className="link" title="Accept Incoming Transaction">
            <TokenDetails amount={item.sendAmount} address={item.tokenAddr} {...{chainId}} />
          </button>
        )},
        {key:'time', label: 'Time', render: (item) => (
          <TimeView timestamp={item.time} />
        )},
        {key:'sender', label: 'Sender', render: (item) => (
          <a className="link" href={`${byChain[chainId].explorer}${item.sender}`} target="_blank" rel="noreferrer">
            {item.sender.slice(0, 8)}...
          </a>
        )},
      ]}
      data={sesh.incoming[chainId][0].found.filter(x => 'sendAmount' in x)}
    />
  );
  else return (
    <GenericSortableTable
      disallowSelection={true}
      columns={[{key:'x', label: ''}]}
      data={[{x:isLoading ? 'Scanning for incoming transactions...' : isError ? 'Error!' : 'Nothing found!'}]}
    />
  );
}

