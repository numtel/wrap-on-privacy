import {useState, useEffect} from 'react';

import {
  useAccount,
  useReadContracts,
} from 'wagmi';

import GenericSortableTable from './SortableTable.js';
import TokenDetails from './TokenDetails.js';
import abi from '../abi/PrivateToken.json';
import {byChain, defaultChain} from '../contracts.js';

export default function LoadActiveTokenCount({ sesh, setActivePool, refreshCounter }) {
  const account = useAccount();
  const chainId = account.chainId || defaultChain;
  const [tokenCount, setTokenCount] = useState(0);
  const contracts = [
    {
      abi,
      chainId,
      address: byChain[chainId].PrivateToken,
      functionName: 'tokenCount',
    },
    ...(new Array(tokenCount).fill(0).map((_, i) => [
      {
        abi,
        chainId,
        address: byChain[chainId].PrivateToken,
        functionName: 'liveTokens',
        args: [ i ],
      },
    ])).flat(),
  ];
  const { data, isError, isLoading, isSuccess, refetch } = useReadContracts({contracts});
  useEffect(() => {
    if(data && data[0].result !== tokenCount) {
      setTokenCount(Number(data[0].result));
    }
  }, [data]);

  useEffect(() => {
    refetch();
  }, [refreshCounter]);

  if(tokenCount && data) return (<TokenTable {...{sesh, setActivePool, chainId, refreshCounter}} data={data.slice(1).map(x=>({address: x.result }))} />);
  return (
    <GenericSortableTable
      columns={[{key:'x', label: ''}]}
      data={[{x:isLoading ? 'Loading...' : isError ? 'Error!' : 'No active pools!'}]}
    />
  );
}

function TokenTable({ sesh, setActivePool, data, chainId, refreshCounter }) {
  const {address, isConnected} = useAccount();

  // Define columns for this table
  const columns = [
    {
      key: 'address',
      label: 'Token',
      render: (item) => (
        <TokenDetails symbol={true} address={item.address} {...{chainId, refreshCounter}} />
      ),
    },
    isConnected ? {
      key: 'address',
      label: 'Public Balance',
      render: (item) => (
        <TokenDetails symbol={true} balanceOf={address} address={item.address} {...{chainId, refreshCounter}} />
      ),
    } : null,
    isConnected ? {
      key: 'address',
      label: 'Private Balance',
      render: (item) => (
        <TokenDetails symbol={true} balanceOf={address} isPrivateBalance={true} address={item.address} {...{chainId, refreshCounter}} />
      ),
    } : null,
    {
      key: 'address',
      label: 'Pool Size',
      render: (item) => (
        <TokenDetails symbol={true} balanceOf={byChain[chainId].PrivateToken} address={item.address} {...{chainId, refreshCounter}} />
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

