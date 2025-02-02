import NTRUWorker from './ntruWorker.js?worker';

export default class NTRUWorkerWrapper {
  constructor(options = {}) {
    Object.assign(this, options);

    // Create a new Worker using the worker script.
    this.worker = new NTRUWorker();
    this.state = null;

    // A counter to assign unique IDs for each request.
    this._requestId = 0;
    // A map from requestId to { resolve, reject } callbacks.
    this._callbacks = {};

    // Listen for messages coming back from the worker.
    this.worker.onmessage = (e) => {
      const { requestId, result, error, state } = e.data;
      const callback = this._callbacks[requestId];
      if (!callback) return;
      if (error) {
        callback.reject(new Error(error));
      } else {
        if(state) {
          this.state = state;
          Object.assign(this, state);
        }
        callback.resolve(result);
      }
      delete this._callbacks[requestId];
    };

    // Immediately initialize the worker’s NTRU instance.
    // (We don’t wait for the result here, but you could if you prefer.)
    this._sendRequest('init', [options]).catch((err) => {
      console.error('Failed to initialize NTRU in worker:', err);
    });
  }

  toJSON() {
    return this.state;
  }

  // Internal helper to send a message and return a Promise.
  _sendRequest(method, args) {
    const id = this._requestId++;
    return new Promise((resolve, reject) => {
      this._callbacks[id] = { resolve, reject };
      this.worker.postMessage({ requestId: id, method, args });
    });
  }

  // The following methods mirror the original NTRU class interface.
  loadPrivateKeyF(fArr) {
    return this._sendRequest('loadPrivateKeyF', [fArr]);
  }

  generatePrivateKeyF() {
    return this._sendRequest('generatePrivateKeyF', []);
  }

  generateNewPublicKeyGH() {
    return this._sendRequest('generateNewPublicKeyGH', []);
  }

  generatePublicKeyH() {
    return this._sendRequest('generatePublicKeyH', []);
  }

  encryptStr(inputPlain) {
    return this._sendRequest('encryptStr', [inputPlain]);
  }

  decryptStr(encrypted) {
    return this._sendRequest('decryptStr', [encrypted]);
  }

  encryptBits(m) {
    return this._sendRequest('encryptBits', [m]);
  }

  decryptBits(e) {
    return this._sendRequest('decryptBits', [e]);
  }

  verifyKeysInputs() {
    return this._sendRequest('verifyKeysInputs', []);
  }

  calculateNq() {
    return this._sendRequest('calculateNq', []);
  }

  calculateNp() {
    return this._sendRequest('calculateNp', []);
  }

  // Optionally, add a method to properly terminate the worker.
  terminate() {
    this.worker.terminate();
  }
}
