import {useState, useEffect} from 'react';
import { useReadContracts } from 'wagmi';
import { formatUnits, erc20Abi } from 'viem';

import abi from '../abi/PrivateToken.json';
import scaledTokenAbi from '../abi/ScaledToken.json';
import {symmetricDecrypt} from '../utils.js';
import {explorerUrl} from '../PrivateTokenSession.js';

const BASE_REQ = 5;

export default function TokenDetails({ address, pool, maybeScaled, amount, balanceOf, isPrivateBalance, symbol, refreshCounter, sesh, hideSymbol }) {
  const general = { address, abi: erc20Abi, chainId: pool.PrivateToken.chain.id};
  const contracts = [
    { ...general, functionName: 'name',},
    { ...general, functionName: 'symbol' },
    { ...general, functionName: 'decimals' },
    { ...general, functionName: 'totalSupply' },
    { address, abi: scaledTokenAbi, chainId: pool.PrivateToken.chain.id, functionName: 'scaledTotalSupply' },
  ];
  if(balanceOf) {
    if(isPrivateBalance && sesh) {
      contracts.push(sesh.balanceViewTx(address, pool));
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
    if(isPrivateBalance) {
      if(data.length === BASE_REQ) {
        // Not logged in
        amount = 0;
      } else if(data[BASE_REQ].result[0] === 0n) {
        amount = 0;
      } else {
        amount = symmetricDecrypt(data[BASE_REQ].result[0], sesh.balanceKeypair().privateKey, data[BASE_REQ].result[1]);
      }
    } else {
      amount = data[BASE_REQ].result;
    }
  }
  if(maybeScaled && data && data[4].result) {
    amount = BigInt(amount) * data[3].result / data[4].result;
  }
  if(data) return (<>
    {amount !== undefined ? `${formatUnits(amount, data[2].result)} ${hideSymbol ? '' : data[1].result}` : <a className="link" href={`${explorerUrl(pool.PrivateToken.chain)}/address/${address}`} target="_blank" rel="noreferrer">{ symbol ?
      data[1].result :
      <>{ data[0].result } ({data[1].result})</>
    }
    </a>}
  </>);
}

