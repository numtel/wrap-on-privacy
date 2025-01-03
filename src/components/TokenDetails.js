import {useState, useEffect} from 'react';
import { useReadContracts } from 'wagmi';
import { formatUnits, erc20Abi } from 'viem';

import {byChain} from '../contracts.js';
import abi from '../abi/PrivateToken.json';
import {symmetricDecrypt} from '../utils.js';

export default function TokenDetails({ address, chainId, amount, balanceOf, isPrivateBalance, symbol, refreshCounter, sesh }) {
  const general = { address, abi: erc20Abi, chainId};
  const contracts = [
    { ...general, functionName: 'name',},
    { ...general, functionName: 'symbol' },
    { ...general, functionName: 'decimals' },
  ];
  if(balanceOf) {
    if(isPrivateBalance && sesh) {
      contracts.push(sesh.balanceViewTx(address, chainId));
    } else if(!isPrivateBalance) {
      contracts.push({ ...general, functionName: 'balanceOf', args: [ balanceOf ] });
    }
  }
  const { data, isError, isLoading, refetch } = useReadContracts({contracts, watch:false});

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
      if(data.length < 4) {
        // Not logged in
        amount = 0;
      } else if(data[3].result[0] === 0n) {
        amount = 0;
      } else {
        console.log(data[3].result);
        amount = symmetricDecrypt(data[3].result[0], sesh.balanceKeypair().privateKey, data[3].result[1]);
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

