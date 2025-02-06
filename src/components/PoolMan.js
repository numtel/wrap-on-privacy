import { useState } from 'react';

import Dialog from './Dialog.js';
import GenericSortableTable from './SortableTable.js';
import DisplayAddress from './DisplayAddress.js';
import { chainsFixed } from './WalletWrapper.js';

import { downloadTextFile } from '../utils.js';

function findChainKey(chainId) {
  for (let key of Object.keys(chainsFixed)) {
    if (chainsFixed[key].id === chainId) return key;
  }
}

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

  function handleImport() {
    // Create an invisible file input element.
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json,text/plain';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const importedPool = JSON.parse(event.target.result);
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
      };
      reader.readAsText(file);
    };
    // Trigger the file selection dialog.
    input.click();
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
    <Dialog show={showPoolMan} setShow={setShowPoolMan}>
      <h2>Pool Manager</h2>
      <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
        <div className="flex flex-col space-y-4">
          <div className="controls">
            <button disabled={selectedIndex === null} className="button" onClick={handleDuplicate}>
              Duplicate
            </button>
            <button disabled={selectedIndex === null} className="button" onClick={handleDelete}>
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

function ChainSelect({ value, setValue, disabled }) {
  return (
    <select value={value} disabled={disabled} onChange={(e) => setValue(e.target.value)}>
      {Object.keys(chainsFixed).map((chainKey) => (
        <option key={chainKey} value={chainKey}>
          {chainsFixed[chainKey].name} ({chainsFixed[chainKey].id})
        </option>
      ))}
    </select>
  );
}

