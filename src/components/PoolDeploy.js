import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  useAccount,
  usePublicClient,
  useWalletClient,
  useSwitchChain,
} from 'wagmi';
import {encodeFunctionData} from 'viem';

import Dialog from './Dialog.js';
import GenericSortableTable from './SortableTable.js';
import DisplayAddress from './DisplayAddress.js';
import { chainsFixed, findChainKey, ChainSelect } from './WalletWrapper.js';

import privacyTokenBuild from '../../out/PrivacyToken.sol/PrivacyToken.json';
import poseidonBuild from '../../out/PoseidonT3.sol/PoseidonT3.json';
import keyRegistryBuild from '../../out/KeyRegistry.sol/KeyRegistry.json';
import privacyTokenInput from '../../out/build-info/input-PrivacyToken.json';
import poseidonInput from '../../out/build-info/input-PoseidonT3.json';
import keyRegistryInput from '../../out/build-info/input-KeyRegistry.json';

import { downloadTextFile } from '../utils.js';
import abi from '../abi/PrivateToken.json';

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
const POSEIDON_KEY = 'contracts/PoseidonT3.sol:PoseidonT3';

export default function PoolDeploy({ sesh, pool, setShowPoolDeploy, showPoolDeploy }) {
  const account = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const [isLoading, setIsLoading] = useState(false);
  const [saveToSession, setSaveToSession] = useState(true);
  const [exportDetails, setExportDetails] = useState(true);
  const [newKeyRegistry, setNewKeyRegistry] = useState(false);
  const [poolName, setPoolName] = useState('New Pool');
  const [privacyTokenChain, setPrivacyTokenChain] = useState('mainnet');
  const [poseidonContract, setPoseidonContract] = useState('');
  const [verifierContract, setVerifierContract] = useState('');
  const [userValidatorContract, setUserValidatorContract] = useState('');

  const poolClient = usePublicClient({ chainId: pool.PrivateToken.chain.id });
  const publicClient = usePublicClient({ chainId: chainsFixed[privacyTokenChain].id });
  const walletClient = useWalletClient({ chainId: chainsFixed[privacyTokenChain].id });

  useEffect(() => {
    async function doAsyncWork() {
      setPrivacyTokenChain(findChainKey(pool.PrivateToken.chain.id));

      // No await so that these async tasks run simultaneously
      poolClient.call({
        to: pool.PrivateToken.address,
        data: encodeFunctionData({
          abi,
          functionName: 'verifier',
        }),
      }).then(result => {
        result.data && setVerifierContract('0x' + result.data.slice(26));
      });

      poolClient.call({
        to: pool.PrivateToken.address,
        data: encodeFunctionData({
          abi,
          functionName: 'userValidator',
        }),
      }).then(result => {
        result.data && Number(result.data) !== 0 && setUserValidatorContract('0x' + result.data.slice(26));
      });

      fetch(`https://sourcify.dev/server/v2/contract/${pool.PrivateToken.chain.id}/${pool.PrivateToken.address}`)
        .then(result => result.json())
        .then(data => {
          let matchType;
          if(data.match === 'exact_match') {
            matchType = 'full_match';
          } else if(data.match === 'match') {
            matchType = 'partial_match';
          }

          if(matchType) {
            return fetch(`https://repo.sourcify.dev/contracts/${matchType}/${pool.PrivateToken.chain.id}/${pool.PrivateToken.address}/metadata.json`)
              .then(result => result.json())
              .then(data => {
                if(POSEIDON_KEY in data.settings.libraries) {
                  setPoseidonContract(data.settings.libraries[POSEIDON_KEY]);
                }
              });
          }

        });
    }

    pool && doAsyncWork();
  }, [ pool ]);

  async function handleSubmit(event) {
    event.preventDefault();
    if(!walletClient.data) {
      toast.error('Wallet not connected!');
      return;
    }
    if((saveToSession || exportDetails) && !poolName) {
      toast.error('Missing Pool Name!');
      return;
    }
    setIsLoading(true);
    try {
      if(account.chainId !== chainsFixed[privacyTokenChain].id) {
        await switchChainAsync({ chainId: chainsFixed[privacyTokenChain].id });
      }
      let keyRegistryTx, privacyTokenTx, poseidonTx;
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
        toast.loading('Verifying KeyRegistry on Sourcify...');
        await verifyOnSourcifyWithRetry(
          chainsFixed[privacyTokenChain].id,
          keyRegistryTx.contractAddress,
          keyRegistryInput,
          keyRegistryBuild.metadata.compiler.version,
          'KeyRegistry',
        );
        toast.dismiss();
      }
      if(!poseidonContract) {
        toast.loading('Deploying PoseidonT3 library...');
        const poseidonTxHash = await walletClient.data.deployContract({
          abi: poseidonBuild.abi,
          bytecode: poseidonBuild.bytecode.object,
        });
        poseidonTx = await publicClient.waitForTransactionReceipt({
          hash: poseidonTxHash,
        });
        toast.dismiss();
      }
      toast.loading('Deploying PrivacyToken contract...');
      const bytecode = privacyTokenBuild.bytecode.object.replaceAll(
        /__[^_]+__/g,
        poseidonContract
          ? poseidonContract.slice(2)
          : poseidonTx.contractAddress.slice(2)
      );
      const privacyTokenArgs = [verifierContract, userValidatorContract || ZERO_ADDR, 2**32];
      const privacyTokenTxHash = await walletClient.data.deployContract({
        abi: privacyTokenBuild.abi,
        bytecode,
        args: privacyTokenArgs,
      });
      privacyTokenTx = await publicClient.waitForTransactionReceipt({
        hash: privacyTokenTxHash,
      });
      toast.dismiss();
      toast.loading('Verifying PrivacyToken on Sourcify...');
      await verifyOnSourcifyWithRetry(
        chainsFixed[privacyTokenChain].id,
        privacyTokenTx.contractAddress,
        privacyTokenInput,
        privacyTokenBuild.metadata.compiler.version,
        'PrivacyToken',
      );
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
    setIsLoading(false);
  }
  const deployCount = (newKeyRegistry ? 1 : 0) + (!poseidonContract ? 1 : 0) + 1;

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
            <span>PoseidonT3 Library Address: (Optional, will be deployed if not specified)</span>
            <input
              value={poseidonContract}
              onChange={(e) => setPoseidonContract(e.target.value)}
            />
          </label>
          <label className="text">
            <span>Verifier Contract Address:</span>
            <input
              value={verifierContract}
              onChange={(e) => setVerifierContract(e.target.value)}
            />
          </label>
          <div className="text-sm py-4">
          <p>Verifiers are stateless. Use an existing verifier or deploy a new one.</p>
          <p>Redeploy verifiers to other chains using Circuitscan by verifying from the same 'requestId'.</p>
          </div>
          <label className="text">
            <span>User Validator Contract Address: (Optional)</span>
            <input
              value={userValidatorContract}
              onChange={(e) => setUserValidatorContract(e.target.value)}
            />
          </label>
        </fieldset>
        <div className="controls center">
          <button className="button" disabled={isLoading}>
            Deploy {deployCount === 1 ? 'Contract' : `${deployCount} Contracts`}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

async function verifyOnSourcify(chainId, contractAddress, input, compilerVersion, contractName) {
  try {
    const apiUrl = `https://sourcify.dev/server/verify/solc-json`;
    const body = JSON.stringify({
      address: contractAddress,
      chain: String(chainId),
      files: {
        value: JSON.stringify(input),
      },
      compilerVersion,
      contractName,
    }, null, 2);
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });

    // Handle the response
    if (response.ok) {
      const result = await response.json();
      console.log("Verification successful:", result);
      return result;
    } else {
      const errorText = await response.text();
      console.error("Verification failed:", errorText);
      throw new Error(errorText);
    }
  } catch (error) {
    console.error("Error verifying contract:", error);
    throw error;
  }
}

// Thanks ChatGPT
async function retryAsync(asyncFunction, retries = 3, delay = 1000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await asyncFunction();
        } catch (error) {
            if (attempt === retries) throw error;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

export function verifyOnSourcifyWithRetry(...args) {
  return retryAsync(async () => verifyOnSourcify(...args), 3, 6000);
}
