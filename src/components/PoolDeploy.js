import { useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  useAccount,
  usePublicClient,
  useWalletClient,
  useSwitchChain,
} from 'wagmi';

import Dialog from './Dialog.js';
import GenericSortableTable from './SortableTable.js';
import DisplayAddress from './DisplayAddress.js';
import { chainsFixed, findChainKey, ChainSelect } from './WalletWrapper.js';

import privacyTokenBuild from '../../out/PrivacyToken.sol/PrivacyToken.json';
import keyRegistryBuild from '../../out/KeyRegistry.sol/KeyRegistry.json';

import { downloadTextFile } from '../utils.js';

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

// TODO verify contracts on etherscan/sourcify
export default function PoolDeploy({ sesh, pool, setShowPoolDeploy, showPoolDeploy }) {
  const account = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const [saveToSession, setSaveToSession] = useState(true);
  const [exportDetails, setExportDetails] = useState(true);
  const [newKeyRegistry, setNewKeyRegistry] = useState(true);
  const [poolName, setPoolName] = useState('');
  const [privacyTokenChain, setPrivacyTokenChain] = useState('mainnet');
  const [verifierContract, setVerifierContract] = useState('');
  const [userValidatorContract, setUserValidatorContract] = useState('');

  const publicClient = usePublicClient({ chainId: chainsFixed[privacyTokenChain].id });
  const walletClient = useWalletClient({ chainId: chainsFixed[privacyTokenChain].id });

  async function handleSubmit(event) {
    event.preventDefault();
    if((saveToSession || exportDetails) && !poolName) {
      toast.error('Missing Pool Name!');
      return;
    }
    if(account.chainId !== chainsFixed[privacyTokenChain].id) {
      await switchChainAsync({ chainId: chainsFixed[privacyTokenChain].id });
    }
    try {
      let keyRegistryTx, privacyTokenTx;
      if(newKeyRegistry) {
        toast.loading('Deploying KeyRegistry contract...');
        const keyRegistryTxHash = await walletClient.data.deployContract({
          abi: keyRegistryBuild.abi,
          bytecode: keyRegistryBuild.bytecode.object,
        });
        keyRegistryTx = await publicClient.waitForTransactionReceipt({
          hash: keyRegistryTxHash,
        });
        toast.dismiss();
      }
      toast.loading('Deploying PrivacyToken contract...');
      const privacyTokenTxHash = await walletClient.data.deployContract({
        abi: privacyTokenBuild.abi,
        bytecode: privacyTokenBuild.bytecode.object,
        args: [verifierContract, userValidatorContract || ZERO_ADDR, 2**32],
      });
      privacyTokenTx = await publicClient.waitForTransactionReceipt({
        hash: privacyTokenTxHash,
      });
      toast.dismiss();
      toast.success('Deployment Complete!');
      const newPool = {
        name: poolName,
        PrivateToken: {
          address: privacyTokenTx.contractAddress,
          chain: chainsFixed[privacyTokenChain],
        },
        KeyRegistry: newKeyRegistry ? {
          address: keyRegistryTx.contractAddress,
          chain: chainsFixed[privacyTokenChain],
        } : pool.KeyRegistry,
      };
      if(saveToSession) {
        sesh.pools.push(newPool);
        sesh.saveToLocalStorage();
      }
      if(exportDetails) {
        downloadTextFile(JSON.stringify({
          ...newPool,
          PrivateToken: {
            ...newPool.PrivateToken,
            chain: { id: newPool.PrivateToken.chain.id }
          },
          KeyRegistry: {
            ...newPool.KeyRegistry,
            chain: { id: newPool.KeyRegistry.chain.id }
          }
        }, null, 2), 'new-pool-definition.json');
      }
    } catch(error) {
      console.log(error);
      toast.dismiss();
      toast.error(error.message || 'Error deploying!');
    }
  }

  return (
    <Dialog show={showPoolDeploy} setShow={setShowPoolDeploy}>
      <h2>Deploy New Pool</h2>
      <form onSubmit={handleSubmit}>
        <fieldset>
          <legend>Deployment Options</legend>
          <label className="radio">
            <input type="checkbox" checked={saveToSession} onChange={e => setSaveToSession(e.target.checked)} />
            <span>Save Pool To Session</span>
          </label>
          <label className="radio">
            <input type="checkbox" checked={exportDetails} onChange={e => setExportDetails(e.target.checked)} />
            <span>Export Pool Details</span>
          </label>
          <label className="radio">
            <input type="checkbox" checked={newKeyRegistry} onChange={e => setNewKeyRegistry(e.target.checked)} />
            <span>Deploy a New Key Registry</span>
          </label>
        </fieldset>
        <fieldset>
          <legend>Pool Details</legend>
          <label className="text">
            <span>Name:</span>
            <input
              value={poolName}
              disabled={!saveToSession && !exportDetails}
              onChange={(e) => setPoolName(e.target.value)}
            />
          </label>
          <label className="text">
            <span>Chain:</span>
            <ChainSelect value={privacyTokenChain} setValue={setPrivacyTokenChain} />
          </label>
          <label className="text">
            <span>Verifier Contract Address:</span>
            <input
              value={verifierContract}
              onChange={(e) => setVerifierContract(e.target.value)}
            />
          </label>
          <div className="text-sm py-4">
          <p>To deploy a new verifier:</p>
            <ol className="list-decimal pl-8">
              <li>Click on 'Verifier on Circuitscan' in the Help > About dialog</li>
              <li>Copy the 'requestId' from 'View Full Details...'</li>
              <li>Click on the 'Verify' button on the Circuitscan homepage</li>
              <li>Resume from that request ID</li>
            </ol>
          </div>
          <label className="text">
            <span>User Validator Contract Address: (Optional)</span>
            <input
              value={userValidatorContract}
              onChange={(e) => setUserValidatorContract(e.target.value)}
            />
          </label>
        </fieldset>
        <div className="controls">
          <button className="button">
            Deploy {newKeyRegistry ? '2 Contracts' : 'Contract'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
