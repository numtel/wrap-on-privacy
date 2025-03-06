import { useState } from 'react';
import { useReadContracts } from 'wagmi';

import Dialog from './Dialog.js';
import GenericSortableTable from './SortableTable.js';
import DisplayAddress from './DisplayAddress.js';
import { chainsFixed, findChainKey, ChainSelect } from './WalletWrapper.js';

import {explorerUrl} from '../PrivateTokenSession.js';
import { downloadTextFile, importJsonFile } from '../utils.js';
import abi from '../abi/PrivateToken.json';

export default function PoolMan({ sesh, setShowPoolMan, showPoolMan }) {
  const [updateCount, setUpdateCount] = useState(0);
  const [poolName, setPoolName] = useState('');
  const [privacyTokenContract, setPrivacyTokenContract] = useState('');
  const [privacyTokenChain, setPrivacyTokenChain] = useState('mainnet');
  const [keyRegistryContract, setKeyRegistryContract] = useState('');
  const [keyRegistryChain, setKeyRegistryChain] = useState('mainnet');
  const [selectedIndex, setSelectedIndex] = useState(null);

  // Helper: Given an original name and the array of pools, produce a new name that appends
  // a copy number if necessary.
  function generateDuplicateName(originalName, pools) {
    // Assume that the base name is before any " #" part.
    const baseName = originalName.split(" #")[0];
    let maxNumber = 1;
    pools.forEach(pool => {
      if (pool.name.startsWith(baseName)) {
        const parts = pool.name.split(" #");
        let num = 1;
        if (parts.length > 1) {
          num = parseInt(parts[1], 10) || 1;
        }
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
    });
    return `${baseName} #${maxNumber + 1}`;
  }

  function handleRowSelection(row) {
    setSelectedIndex(row);
    if (row !== null) {
      setPoolName(sesh.pools[row].name);
      setPrivacyTokenContract(sesh.pools[row].PrivateToken.address);
      setPrivacyTokenChain(findChainKey(sesh.pools[row].PrivateToken.chain.id));
      setKeyRegistryContract(sesh.pools[row].KeyRegistry.address);
      setKeyRegistryChain(findChainKey(sesh.pools[row].KeyRegistry.chain.id));
    } else {
      setPoolName('');
      setPrivacyTokenContract('');
      setPrivacyTokenChain('mainnet');
      setKeyRegistryContract('');
      setKeyRegistryChain('mainnet');
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (selectedIndex === null) return;

    // Update the selected pool with the values from the form inputs.
    const updatedPool = { ...sesh.pools[selectedIndex] };
    updatedPool.name = poolName;
    updatedPool.PrivateToken = {
      ...updatedPool.PrivateToken,
      address: privacyTokenContract,
      chain: chainsFixed[privacyTokenChain]
    };
    updatedPool.KeyRegistry = {
      ...updatedPool.KeyRegistry,
      address: keyRegistryContract,
      chain: chainsFixed[keyRegistryChain]
    };

    sesh.pools[selectedIndex] = updatedPool;
    sesh.saveToLocalStorage();
    setUpdateCount(updateCount + 1);
  }

  function handleDuplicate() {
    if (selectedIndex === null) return;
    const poolToDuplicate = sesh.pools[selectedIndex];

    // Create a new pool by cloning the selected one.
    const newPool = {
      ...poolToDuplicate,
      name: generateDuplicateName(poolToDuplicate.name, sesh.pools),
      PrivateToken: { ...poolToDuplicate.PrivateToken },
      KeyRegistry: { ...poolToDuplicate.KeyRegistry }
    };

    sesh.pools.push(newPool);
    sesh.saveToLocalStorage();
    setUpdateCount(updateCount + 1);
  }

  function handleDelete() {
    if (selectedIndex === null) return;
    if (!confirm(`Are you sure you wish to delete "${sesh.pools[selectedIndex].name}"?`)) return;
    // Remove the pool at selectedIndex.
    sesh.pools = sesh.pools.filter((_, index) => index !== selectedIndex);
    sesh.saveToLocalStorage();
    // Clear the selection and reset form fields.
    setSelectedIndex(null);
    setPoolName('');
    setPrivacyTokenContract('');
    setPrivacyTokenChain('mainnet');
    setKeyRegistryContract('');
    setKeyRegistryChain('mainnet');
    setUpdateCount(updateCount + 1);
  }

  async function handleImport() {
    try {
      const importedPool = await importJsonFile();
      if(typeof importedPool.name !== 'string'
        || typeof importedPool.PrivateToken !== 'object'
        || typeof importedPool.KeyRegistry !== 'object') {
        throw new Error('Invalid pool import!');
      }
      // Restore chain details by replacing the chain object with the full chain info
      // from chainsFixed (using the chain id).
      if (
        importedPool.PrivateToken &&
        importedPool.PrivateToken.chain &&
        importedPool.PrivateToken.chain.id
      ) {
        const tokenChainKey = findChainKey(importedPool.PrivateToken.chain.id);
        if (tokenChainKey) {
          importedPool.PrivateToken.chain = chainsFixed[tokenChainKey];
        }
      }
      if (
        importedPool.KeyRegistry &&
        importedPool.KeyRegistry.chain &&
        importedPool.KeyRegistry.chain.id
      ) {
        const keyRegistryChainKey = findChainKey(importedPool.KeyRegistry.chain.id);
        if (keyRegistryChainKey) {
          importedPool.KeyRegistry.chain = chainsFixed[keyRegistryChainKey];
        }
      }
      // If the imported pool’s name already exists, generate a new name.
      if (sesh.pools.some(pool => pool.name === importedPool.name)) {
        importedPool.name = generateDuplicateName(importedPool.name, sesh.pools);
      }
      sesh.pools.push(importedPool);
      sesh.saveToLocalStorage();
      setUpdateCount(x => x + 1);
    } catch (err) {
      console.error('Error importing pool:', err);
      alert('Failed to import pool: ' + err.message);
    }
  }

  function handleExport() {
    if (selectedIndex === null) return;
    const pool = sesh.pools[selectedIndex];
    // Create an export copy that retains only the chain id in each contract’s chain.
    const exportPool = {
      ...pool,
      PrivateToken: {
        ...pool.PrivateToken,
        chain: { id: pool.PrivateToken.chain.id }
      },
      KeyRegistry: {
        ...pool.KeyRegistry,
        chain: { id: pool.KeyRegistry.chain.id }
      }
    };
    const data = exportPool;
    downloadTextFile(JSON.stringify(data, null, 2), 'pool-definition.json');
  }

  return (
    <Dialog title="Pool Manager" show={showPoolMan} setShow={setShowPoolMan}>
      <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
        <div className="flex flex-col space-y-4">
          <div className="controls">
            <button disabled={selectedIndex === null} className="button" onClick={handleDuplicate}>
              Duplicate
            </button>
            <button disabled={selectedIndex === null || sesh.pools.length < 2} className="button" onClick={handleDelete}>
              Delete...
            </button>
            <button className="button" onClick={handleImport}>
              Import...
            </button>
          </div>
          <GenericSortableTable
            className=""
            onActiveChange={handleRowSelection}
            columns={[{ key: 'name', label: 'Pool Name' }]}
            data={sesh.pools}
          />
        </div>
        <form onSubmit={handleSubmit}>
          <fieldset>
            <legend>Pool Details</legend>
            <label className="text">
              <span>Name:</span>
              <input
                value={poolName}
                disabled={selectedIndex === null}
                onChange={(e) => setPoolName(e.target.value)}
              />
            </label>
          </fieldset>
          <fieldset>
            <legend>PrivacyToken contract</legend>
            <label className="text">
              <span>Chain:</span>
              <ChainSelect value={privacyTokenChain} setValue={setPrivacyTokenChain} disabled={selectedIndex === null} />
            </label>
            <label className="text">
              <span>Address:</span>
              <input
                value={privacyTokenContract}
                disabled={selectedIndex === null}
                onChange={(e) => setPrivacyTokenContract(e.target.value)}
              />
            </label>
            <p>
              <a disabled={selectedIndex === null} href={`${explorerUrl(chainsFixed[privacyTokenChain])}/address/${privacyTokenContract}`} className="link" rel="noopener" target="_blank">
                View Contract on Explorer
              </a><br />
              <VerifierLink disabled={selectedIndex === null} chainId={chainsFixed[privacyTokenChain].id} {...{privacyTokenContract}} />
            </p>
          </fieldset>
          <fieldset>
            <legend>KeyRegistry contract</legend>
            <label className="text">
              <span>Chain:</span>
              <ChainSelect value={keyRegistryChain} setValue={setKeyRegistryChain} disabled={selectedIndex === null} />
            </label>
            <label className="text">
              <span>Address:</span>
              <input
                value={keyRegistryContract}
                disabled={selectedIndex === null}
                onChange={(e) => setKeyRegistryContract(e.target.value)}
              />
            </label>
            <p>
              <a disabled={selectedIndex === null} href={`${explorerUrl(chainsFixed[keyRegistryChain])}/address/${keyRegistryContract}`} className="link" rel="noopener" target="_blank">
                View Contract on Explorer
              </a><br />
            </p>
          </fieldset>
          <div className="controls">
            <button disabled={selectedIndex === null} className="button">
              Save
            </button>
            <button
              disabled={selectedIndex === null}
              className="button"
              type="button"
              onClick={handleExport}
            >
              Export
            </button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}

function VerifierLink({ chainId, privacyTokenContract, disabled }) {
  const contracts = [
    {
      abi,
      address: privacyTokenContract,
      chainId,
      functionName: 'verifier',
    },
  ];
  const { data, isError, isLoading, refetch } = useReadContracts({contracts, watch:false});
  if(disabled) return (<a disabled={true} href={`https://circuitscan.org/`} className="link" rel="noopener" target="_blank">
    Verifier on Circuitscan
  </a>);
  if(isLoading) return (<span>Loading...</span>);
  if(isError || (data && !data[0].result)) return (<span>Unable to determine verifier!</span>);
  if(data) return (<a href={`https://circuitscan.org/chain/${chainId}/address/${data[0].result}`} className="link" rel="noopener" target="_blank">
    Verifier on Circuitscan
  </a>);
}
