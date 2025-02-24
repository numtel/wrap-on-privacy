import {useEffect} from 'react';
import {useReadContracts} from 'wagmi';

import GenericSortableTable from './SortableTable.js';
import TokenDetails from './TokenDetails.js';
import TimeView from './TimeView.js';
import DisplayAddress from './DisplayAddress.js';
import { downloadTextFile } from '../utils.js';
import {poolId, explorerUrl} from '../PrivateTokenSession.js';

import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/16/solid';

export default function OutgoingTable({ pool, sesh, refreshCounter, setActivePool }) {
  const tx = sesh.outgoing[poolId(pool)];
  if(!tx) return (
    <GenericSortableTable
      disallowSelection={true}
      columns={[{key:'x', label: ''}]}
      data={[{x:'Nothing found!'}]}
    />
  );

  function handleRowSelection(index, rowData) {
    rowData && setActivePool(rowData.tokenAddr);
  }

  function exportTx(item) {
    downloadTextFile(JSON.stringify(item, null, 2), 'outgoing-tx.json');
  }

  return (
    <GenericSortableTable
      onActiveChange={handleRowSelection}
      columns={[
        {
          key: 'address',
          label: 'Token',
          render: (item) => (
            <TokenDetails symbol={true} address={item.tokenAddr} {...{pool, refreshCounter}} />
          ),
        },
        {key:'sendAmount', label: 'Outgoing Amount', render: (item) => (
          <button title="Export Transaction" className="link" onClick={() => exportTx(item)}>
            <TokenDetails maybeScaled={true} amount={BigInt(item.sendAmount)} address={item.tokenAddr} {...{pool}} />
          </button>
        )},
        {key:'recipAddr', label: 'Intended Recipient', render: (item) => (<>
          <a className="link" href={`${explorerUrl(pool.PrivateToken.chain)}/address/${item.recipAddr}`} target="_blank" rel="noreferrer">
            <DisplayAddress address={item.recipAddr} />
          </a>&nbsp;
          <KeyMatches {...{item, sesh, pool, refreshCounter}} />
        </>)},
        {key:'time', label: 'Time', render: (item) => (
          <TimeView timestamp={item.time} />
        )},
      ]}
      data={tx}
    />
  );
}

function KeyMatches({ sesh, pool, item, refreshCounter }) {
  const pubKeyTx = sesh && pool && sesh.registerTx(pool);
  const contracts = [
    {
      ...pubKeyTx,
      functionName: 'data',
      args: [ item.recipAddr ],
    },
  ];
  const { data, isError, isLoading, isSuccess, refetch } = useReadContracts({contracts, watch: false });

  useEffect(() => {
    refetch();
  }, [refreshCounter]);

  if(data) {
    const expected = item.hBytes + item.recipPublicKey.slice(2);
    if(data[0].result === expected) {
      return (
        <CheckCircleIcon title="Registered Key Matches" className="h-5 w-5 mr-1 text-green-700 dark:text-green-300 inline-block" />
      );
    } else {
      return (
        <ExclamationTriangleIcon title="Registered Key Does Not Match" className="h-5 w-5 mr-1 text-red-700 dark:text-red-400 inline-block" />
      );
    }
  }
}
