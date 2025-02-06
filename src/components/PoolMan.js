import Dialog from './Dialog.js';

export default function PoolMan({ sesh, setSesh, setShowPoolMan, showPoolMan }) {
  return (<Dialog show={showPoolMan} setShow={setShowPoolMan}>
    <h2>Pool Manager</h2>
    <p>foobar</p>
  </Dialog>);
}
