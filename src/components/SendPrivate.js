
import {useState, useEffect} from 'react';

import {
  useAccount,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';

export default function SendPrivate({}) {
  const [amount, setAmount] = useState(1);

  async function handleSubmit(event) {
    event.preventDefault();
  }

  return <form onSubmit={handleSubmit}>
  </form>;
}
