import {useState, useEffect} from 'react';
import { toast } from 'react-hot-toast';
import { poseidon6 } from 'poseidon-lite';
import { getContract } from 'viem';

import {
  useAccount,
  useSwitchChain,
  useReadContracts,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';

import GenericSortableTable from './SortableTable.js';
import TokenDetails from './TokenDetails.js';
import DisplayAddress from './DisplayAddress.js';
import TimeView from './TimeView.js';
import abi from '../abi/PrivateToken.json';
import {poolId, explorerUrl} from '../PrivateTokenSession.js';

const PAGE_SIZE = 50;
export const DISABLED_STATUS = 'Sync Disabled.';

// TODO proper support for treeIndex on scanForIncoming
export default function LoadIncoming({ pool, sesh, refreshCounter, setRefreshStatus, hidden, syncStatus, setSyncStatus, setActivePool }) {
  const treeIndex = 0;
  const account = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: pool.PrivateToken.chain.id });
  const registryClient = usePublicClient({ chainId: pool.KeyRegistry.chain.id });
  const [contracts, setContracts] = useState([]);
  const { data, isError, isLoading, isSuccess, refetch } = useReadContracts({contracts, watch: false });
  const [cleanDataUpdate, setCleanData] = useState([]);
  const { writeContract, isPending, isError: isWriteError, data: writeData, error: writeError } = useWriteContract();
  const { isError: txError, isPending: txPending, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: writeData });

  useEffect(() => {
    async function doAsync() {
      setContracts([]);
      // TODO use wagmi/core multicall inside scanForIncoming instead of this useReadContracts spaghetti
      const params = await sesh.scanForIncoming(publicClient, treeIndex, pool);
      let newCount = params.count - params.oldCount;

      if(newCount < 0) newCount = 0;
      if(newCount > PAGE_SIZE) newCount = PAGE_SIZE;

      const contracts = new Array(newCount).fill(0).map((_, i) => [
        {
          abi,
          chainId: pool.PrivateToken.chain.id,
          address: pool.PrivateToken.address,
          functionName: 'encryptedSends',
          args: [ treeIndex, i + params.oldCount ],
        },
        {
          abi,
          chainId: pool.PrivateToken.chain.id,
          address: pool.PrivateToken.address,
          functionName: 'sendTimes',
          args: [ treeIndex, i + params.oldCount ],
        },
        {
          abi,
          chainId: pool.PrivateToken.chain.id,
          address: pool.PrivateToken.address,
          functionName: 'sendAccounts',
          args: [ treeIndex, i + params.oldCount ],
        },
        {
          abi,
          chainId: pool.PrivateToken.chain.id,
          address: pool.PrivateToken.address,
          functionName: 'sendHashes',
          args: [ treeIndex, i + params.oldCount ],
        },
      ]).flat();
      setContracts(contracts);
    }
    sesh && !syncStatus && doAsync();
  }, [refreshCounter, treeIndex, pool, setSyncStatus, syncStatus]);

  useEffect(() => {
    async function asyncWork() {
      const firstIndex = contracts[0].args[1];
      const lastIndex = contracts[contracts.length-1].args[1];
      setSyncStatus(curVal => {
        if(curVal === DISABLED_STATUS) {
          return DISABLED_STATUS;
        }
        return `Scanning from ${firstIndex} to ${lastIndex}...`
      });
      const allDecrypts = [];
      for(let i = 0; i < data.length; i+=4) {
        allDecrypts.push((async function() {
          const cleanData = [];
          const index = i/4 + firstIndex;
          const decrypted = await sesh.decryptIncoming(data[i].result, pool);
          if(decrypted && decrypted.hash === data[i+3].result) {
            const newItem = {
              index,
              receiveTxHash: data[i+3].result.toString(10),
              sendAmount: decrypted.sendAmount.toString(10),
              sendBlinding: decrypted.sendBlinding.toString(10),
              tokenAddr: '0x' + decrypted.tokenAddr.toString(16),
              time: Number(data[i+1].result),
              sender: data[i+2].result,
            };
            cleanData.push(newItem);
          } else {
            // Save space on the tree leaves that aren't for this account
            cleanData.push({
              index,
              receiveTxHash: data[i+3].result.toString(10),
            });
          }
          // Push item to sesh
          sesh.setLastScanned(treeIndex, pool, index, cleanData[0]);
          // Re-render
          setCleanData(cleanData);
        })());
      }
      await Promise.all(allDecrypts);
      sesh.incoming[poolId(pool)][treeIndex].count = lastIndex + 1;
      await sesh.saveToLocalStorage();
      // Re-render
      setCleanData([]);
      setSyncStatus(curVal => {
        if(curVal === DISABLED_STATUS) {
          return DISABLED_STATUS;
        }
        // syncStatus null = not active, false = disabled
        return null;
      });
    }
    if(isSuccess) {
      asyncWork();
    }
  }, [isSuccess, setSyncStatus, pool]);

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
      setRefreshStatus(x => x+1);
    }
  }, [writeData, isPending, isError, txError, txPending, txSuccess]);

  async function acceptIncoming(item) {
    toast.loading('Generating proof...');
    const tx = await sesh.receiveTx(pool, treeIndex, item, publicClient, registryClient);
    toast.dismiss();
    toast.loading('Waiting for transaction...');

    if(account.chainId !== pool.PrivateToken.chain.id) {
      await switchChainAsync({ chainId: pool.PrivateToken.chain.id });
    }
    writeContract(tx);
  }

  function handleRowSelection(index, rowData) {
    setActivePool(rowData ? rowData.tokenAddr : null);
  }

  if(hidden) return null;
  if(sesh && (poolId(pool) in sesh.incoming) && (treeIndex in sesh.incoming[poolId(pool)])) return (
    <GenericSortableTable
      className={sesh.hideAlreadyAccepted ? 'hideAccepted' : ''}
      onActiveChange={handleRowSelection}
      columns={[
        {key:'index', label: 'Index'},
        {key:'decrypted', label: 'Incoming Amount', render: (item) => (
          <AlreadySubmitted
            {...{sesh, pool, refreshCounter}} client={publicClient} newItem={item}
            ifNot={
              <button onClick={() => acceptIncoming(item)} className="link" title="Accept Incoming Transaction">
                <TokenDetails maybeScaled={true} amount={item.sendAmount} address={item.tokenAddr} {...{pool}} />
              </button>
            }
            ifSubmitted={
              <span className="submitted">
                <TokenDetails maybeScaled={true} amount={item.sendAmount} address={item.tokenAddr} {...{pool}} />
              </span>
            }
          />
        )},
        {key:'time', label: 'Time', render: (item) => (
          <TimeView timestamp={item.time} />
        )},
        {key:'sender', label: 'Sender', render: (item) => (
          <a className="link" href={`${explorerUrl(pool.PrivateToken.chain)}/address/${item.sender}`} target="_blank" rel="noreferrer">
            <DisplayAddress address={item.sender} />
          </a>
        )},
      ]}
      data={sesh.incoming[poolId(pool)][0].found.filter(x => 'sendAmount' in x)}
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


export function AlreadySubmitted({ sesh, newItem, pool, client, ifSubmitted, ifNot, refreshCounter }) {
  const [submitted, setSubmitted] = useState(null);
  const keypair = sesh.balanceKeypair();
  const contract = getContract({
    client,
    abi,
    address: pool.PrivateToken.address,
  });

  useEffect(() => {
    async function asyncWork() {
      const data = await contract.read.receivedHashes([poseidon6([
        newItem.tokenAddr,
        pool.PrivateToken.chain.id,
        newItem.sendAmount,
        newItem.sendBlinding,
        keypair.publicKey,
        keypair.privateKey
      ])]);
      setSubmitted(data);
    }
    sesh && newItem && client && asyncWork();
  }, [sesh, newItem, client, refreshCounter]);

  if(submitted === null) return (<>Loading...</>);
  if(!submitted) return ifNot;
  if(submitted) return ifSubmitted;
}
