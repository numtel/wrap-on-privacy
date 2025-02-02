import {useState, useEffect} from 'react';
import {usePublicClient} from 'wagmi';
import {isAddress} from 'viem';

export default function DisplayAddress({address}) {
  const [ensName, setENSName] = useState(null);
  const publicClient = usePublicClient({ chainId: 1 });

  useEffect(() => {
    async function asyncWork() {
      const data = await publicClient.getEnsName({address});
      if(data) setENSName(data);
    }
    isAddress(address) && publicClient && asyncWork();
  }, [address, publicClient]);

  if(!ensName) return (<>{address.slice(0, 8)}...</>);
  return (<>{ensName}</>);
}
