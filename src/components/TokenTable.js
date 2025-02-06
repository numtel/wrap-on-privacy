import {useState, useEffect} from 'react';

import {
  useAccount,
  useReadContracts,
} from 'wagmi';

import GenericSortableTable from './SortableTable.js';
import TokenDetails from './TokenDetails.js';
import abi from '../abi/PrivateToken.json';

export default function LoadActiveTokenCount({ pool, sesh, setActivePool, refreshCounter }) {
  const [tokenCount, setTokenCount] = useState(0);
  const contracts = [
    {
      abi,
      chainId: pool.PrivateToken.chain.id,
      address: pool.PrivateToken.address,
      functionName: 'tokenCount',
    },
    ...(new Array(tokenCount).fill(0).map((_, i) => [
      {
        abi,
        chainId: pool.PrivateToken.chain.id,
        address: pool.PrivateToken.address,
        functionName: 'liveTokens',
        args: [ i ],
      },
    ])).flat(),
  ];
  const { data, isError, isLoading, isSuccess, refetch } = useReadContracts({contracts, watch: false });
  useEffect(() => {
    if(data && data[0].result !== tokenCount && !isNaN(Number(data[0].result))) {
      setTokenCount(Number(data[0].result));
    }
  }, [data]);

  useEffect(() => {
    refetch();
  }, [refreshCounter]);

  if(tokenCount && data) return (<TokenTable {...{sesh, setActivePool, pool, refreshCounter}} data={data.slice(1).map(x=>({address: x.result }))} />);
  return (
    <GenericSortableTable
      disallowSelection={true}
      columns={[{key:'x', label: ''}]}
      data={[{x:isLoading ? 'Loading...' : isError ? 'Error!' : 'No active pools!'}]}
    />
  );
}

function TokenTable({ sesh, setActivePool, data, pool, refreshCounter }) {
  const {address, isConnected} = useAccount();

  // Define columns for this table
  const columns = [
    {
      key: 'address',
      label: 'Token',
      render: (item) => (
        <TokenDetails symbol={true} address={item.address} {...{pool, refreshCounter}} />
      ),
    },
    isConnected ? {
      key: 'address',
      label: 'Public Balance',
      render: (item) => (
        <TokenDetails symbol={true} balanceOf={address} address={item.address} {...{pool, refreshCounter}} />
      ),
    } : null,
    isConnected ? {
      key: 'address',
      label: 'Private Balance',
      render: (item) => (
        <TokenDetails maybeScaled={true} symbol={true} balanceOf={address} isPrivateBalance={true} address={item.address} {...{pool, refreshCounter, sesh}} />
      ),
    } : null,
    {
      key: 'address',
      label: 'Pool Size',
      render: (item) => (
        <TokenDetails symbol={true} balanceOf={pool.PrivateToken.address} address={item.address} {...{pool, refreshCounter}} />
      ),
    },
  ].filter(x => x !== null);

  function handleRowSelection(index, rowData) {
    setActivePool(rowData ? rowData.address : null);
  }

  return (
    <GenericSortableTable
      columns={columns}
      data={data}
      onActiveChange={handleRowSelection}
    />
  );
}

