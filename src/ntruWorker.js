import NTRU from 'ntru-circom';

// We'll keep one NTRU instance per worker.
let ntruInstance = null;

// Listen for messages from the main thread.
self.onmessage = function (e) {
  const { requestId, method, args } = e.data;

  // “init” is a special method that creates the NTRU instance.
  if (method === 'init') {
    try {
      const options = args[0] || {};
      ntruInstance = new NTRU(options);
      self.postMessage({ requestId, result: 'initialized' });
    } catch (err) {
      self.postMessage({ requestId, error: err.message });
    }
    return;
  }

  if (!ntruInstance) {
    self.postMessage({ requestId, error: 'NTRU instance not initialized' });
    return;
  }

  try {
    // Call the desired method on the NTRU instance.
    // (All your methods in the original class are synchronous.)
    const result = ntruInstance[method](...args);
    const state = JSON.parse(JSON.stringify(ntruInstance));
    self.postMessage({ requestId, result, state });
  } catch (error) {
    self.postMessage({ requestId, error: error.message });
  }
};

