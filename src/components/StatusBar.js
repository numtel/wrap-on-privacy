import {useEffect} from 'react';
import {
  useAccount,
  useReadContracts,
} from 'wagmi';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/16/solid';

export default function StatusBar({ sesh, refreshCounter }) {
  const account = useAccount();
  const pubKeyTx = sesh && account.chainId && sesh.registerTx(account.chainId);
  const contracts = [
    {
      ...pubKeyTx,
      functionName: 'data',
      args: [ account.address ],
    },
  ];
  const { data, isError, isLoading, isSuccess, refetch } = useReadContracts({
    contracts,
  });

  useEffect(() => {
    refetch();
  }, [refreshCounter]);

  return (<div className="status-bar">
    <div>
      {!account.isConnected ? 'Wallet Not Connected' :
        !sesh ? 'Not Logged In' :
        isLoading ? 'Loading key registration status...' :
        data && pubKeyTx && data[0].result !== pubKeyTx.args[0] ? <>
          <ExclamationTriangleIcon className="h-5 w-5 mr-1 text-red-700 inline-block" />
          Registered key does not match. Cannot receive on this private account at this Ethereum address.
        </> :
        data && pubKeyTx && data[0].result === pubKeyTx.args[0] ? <>
          <CheckCircleIcon className="h-5 w-5 mr-1 text-green-700 inline-block" />
          Registered key matches. Able to receive on this private account at this Ethereum address.
        </>:
        'Unknown receive status.'}
    </div>
  </div>);
}
