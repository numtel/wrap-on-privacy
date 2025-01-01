import {useState, useEffect} from 'react';
import { useReadContracts } from 'wagmi';
import { formatUnits, erc20Abi } from 'viem';

import {byChain} from '../contracts.js';
import abi from '../abi/PrivateToken.json';

export default function TokenDetails({ address, chainId, amount, balanceOf, isPrivateBalance, symbol, refreshCounter }) {
  const general = { address, abi: erc20Abi, chainId};
  const contracts = [
    { ...general, functionName: 'name',},
    { ...general, functionName: 'symbol' },
    { ...general, functionName: 'decimals' },
  ];
  if(balanceOf) {
    contracts.push(isPrivateBalance ?
      {
        address: byChain[chainId].PrivateToken,
        abi,
        functionName: 'accounts',
        args: [
          address,
          balanceOf,
        ],
      } : { ...general, functionName: 'balanceOf', args: [ balanceOf ] });
  }
  const { data, isError, isLoading, refetch } = useReadContracts({contracts});

  useEffect(() => {
    refetch();
  }, [refreshCounter]);

  if(isLoading) return (
    <span>Loading...</span>
  );
  if(isError || (data && data[0].error)) return (
    <span>Invalid ERC20 Token!</span>
  );
  if(data && balanceOf) {
    // TODO support private balances, message when not logged into this account
    if(isPrivateBalance) {
      if(data[3].result[0] === 0n) {
        amount = 0;
      } else {
        console.log(data[3].result);
        amount = 777;
      }
    } else {
      amount = data[3].result;
    }
  }
  if(data) return (<>
    {amount !== undefined ? `${formatUnits(amount, data[2].result)} ${data[1].result}` : <a className="link" href={`${byChain[chainId].explorer}${address}`} target="_blank" rel="noreferrer">{ symbol ?
      data[1].result :
      <>{ data[0].result } ({data[1].result})</>
    }
    </a>}
  </>);
}

