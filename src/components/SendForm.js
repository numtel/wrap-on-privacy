import {
  useAccount,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';

export default function SendForm({ sesh, tokenAddr, chainId }) {
  async function handleSubmit(event) {
    event.preventDefault();
  }

  function sendToSelf() {
  }

  return (<dialog open>
    <h2>Transfer Tokens</h2>
    <form onSubmit={handleSubmit}>
      <div className="flex flex-col mb-4 sm:flex-row sm:space-x-4 justify-evenly sm:space-y-0 space-y-4">
        <fieldset>
          <legend>Source</legend>
          <label className="radio">
            <input type="radio" name="source" value="public" />
            <span>Public Balance</span>
          </label>
          <label className="radio">
            <input type="radio" name="source" value="private" />
            <span>Private Balance</span>
          </label>
          <label className="text">
            <span>Amount:</span>
            <input name="sendAmount" type="number" min="0" />
          </label>
        </fieldset>
        <fieldset>
          <legend>Recipient</legend>
          <label className="radio">
            <input type="radio" name="recipType" value="public" />
            <span>Public</span>
          </label>
          <label className="radio">
            <input type="radio" name="recipType" value="private" />
            <span>Private</span>
          </label>
          <label className="text">
            <span>Address or ENS name:</span>
            <input name="recipAddr" />
          </label>
          <button className="link" type="button" onClick={sendToSelf}>
            Send to Self
          </button>
        </fieldset>
      </div>
      <div className="controls">
        <button className="button" type="submit">
          Send
        </button>
      </div>
    </form>
  </dialog>);
}
