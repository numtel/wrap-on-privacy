import { useReadContracts } from 'wagmi';
import { formatUnits, erc20Abi } from 'viem';

import {byChain} from '../contracts.js';
import abi from '../abi/PrivateToken.json';

export default function TokenDetails({ address, chainId, amount, balanceOf, isPrivateBalance, symbol }) {
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
  const { data, isError, isLoading } = useReadContracts({contracts});
  if(isLoading) return (
    <span>Loading...</span>
  );
  if(isError || (data && data[0].error)) return (
    <span>Invalid ERC20 Token!</span>
  );
  if(data && balanceOf) {
    // TODO support private balances, message when not logged into this account
    console.log(data[3].result);
    amount = data[3].result;
  }
  if(data) return (<>
    {amount !== undefined && formatUnits(amount, data[2].result)}&nbsp;
    <a className="link" href={`${byChain[chainId].explorer}${address}`} target="_blank" rel="noreferrer">{ symbol ?
      data[1].result :
      <>{ data[0].result } ({data[1].result})</>
    }
    </a>
  </>);
}

