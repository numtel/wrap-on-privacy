import { useEffect, useState, useRef } from 'react';

const data = new Array(1000).fill(0).map((_, i) => ({
  address: '0x2c35714c1df8069856e41e7b75b2270929b6459c',
  name: `MockERC20 #${i + 1}`,
  pubBalance: i * 3,
  privBalance: (i * 4) % 332,
  poolSize: 382938,
}));

export default function TokenTable({ sesh }) {
  const [active, setActive] = useState(null);
  const [isDown, setIsDown] = useState(false);
  const [sortKey, setSortKey] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'
  const menuRef = useRef(null);

  function handleSort(key) {
    const newOrder = sortKey === key && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortKey(key);
    setSortOrder(newOrder);

    data.sort((a, b) => {
      if (a[key] < b[key]) return newOrder === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return newOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  useEffect(() => {
    function handleOutsideMove(event) {
      if (menuRef.current && (!menuRef.current.contains(event.target) || menuRef.current === event.target)) {
        setIsDown(false);
      }
    }

    document.addEventListener('mousemove', handleOutsideMove);

    return () => {
      document.removeEventListener('mousemove', handleOutsideMove);
    };
  }, []);

  return (
    <div className="panel" ref={menuRef}>
      <table cellPadding="0">
        <thead>
          <tr>
            <th><span onClick={() => handleSort('address')}>Address</span></th>
            <th><span onClick={() => handleSort('name')}>Name</span></th>
            <th><span onClick={() => handleSort('pubBalance')}>Public Balance</span></th>
            <th><span onClick={() => handleSort('privBalance')}>Private Balance</span></th>
            <th><span onClick={() => handleSort('poolSize')}>Pool Size</span></th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, i) => (
            <tr
              key={i}
              className={active === i ? 'active' : ''}
              onMouseDown={() => {
                setIsDown(true);
                setActive(i);
              }}
              onMouseMove={() => {
                if (isDown) setActive(i);
              }}
              onMouseUp={() => {
                setIsDown(false);
                setActive(i);
              }}
              onTouchStart={() => {
                setIsDown(true);
                setActive(i);
              }}
              onTouchMove={() => {
                if (isDown) setActive(i);
              }}
              onTouchEnd={() => {
                setIsDown(false);
                setActive(i);
              }}
            >
              <td>
                <a
                  href={`https://sepolia.etherscan.io/address/${item.address}`}
                  target="_blank"
                  rel="noopener"
                  className="link"
                >
                  {item.address}
                </a>
              </td>
              <td>{item.name}</td>
              <td>{item.pubBalance}</td>
              <td>{item.privBalance}</td>
              <td>{item.poolSize}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

