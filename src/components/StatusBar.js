import {useEffect} from 'react';
import {
  useAccount,
  useReadContracts,
} from 'wagmi';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/16/solid';

export default function StatusBar({ sesh, refreshCounter, syncStatus }) {
  const account = useAccount();
  const pubKeyTx = sesh && account.chainId && sesh.registerTx(account.chainId);
  const contracts = [
    {
      ...pubKeyTx,
      functionName: 'data',
      args: [ account.address ],
    },
  ];
  const { data, isError, isLoading, isSuccess, refetch } = useReadContracts({contracts, watch: false });

  useEffect(() => {
    refetch();
  }, [refreshCounter]);

  return (<div className="status-bar">
    <div>
      {!account.isConnected ? 'Wallet Not Connected' :
        !sesh ? 'Not Logged In' :
        isLoading ? 'Loading key registration status...' :
        data && pubKeyTx && data[0].result !== pubKeyTx.args[0] ? <>
          <ExclamationTriangleIcon className="h-5 w-5 mr-1 text-red-700 dark:text-red-400 inline-block" />
          Must register key to receive on this address.
        </> :
        data && pubKeyTx && data[0].result === pubKeyTx.args[0] ? <>
          <CheckCircleIcon className="h-5 w-5 mr-1 text-green-700 dark:text-green-300 inline-block" />
          Key registered, receiving on this address.
        </>:
        'Unknown receive status.'}
    </div>
    {syncStatus && <div>
      {syncStatus}
    </div>}
  </div>);
}
