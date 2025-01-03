import React, { useEffect, useState, useRef, useCallback } from 'react';

export default function GenericSortableTable({
  columns = [],
  data = [],
  onActiveChange,
  disallowSelection,
}) {
  const [active, setActive] = useState(null);
  const [isDown, setIsDown] = useState(false);
  const [sortKey, setSortKey] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'

  const menuRef = useRef(null);

  // Sort handler
  function handleSort(key) {
    const newOrder = sortKey === key && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortKey(key);
    setSortOrder(newOrder);
  }

  // Helper to update active state and call the callback
  const handleActiveChange = useCallback(index => {
    if(disallowSelection) return;
    setActive(index);
    if (typeof onActiveChange === 'function') {
      onActiveChange(index, sortedData[index]);
    }
  }, [disallowSelection, onActiveChange]);

  // Sort the data in a stable way (create a copy first)
  const sortedData = [...data].sort((a, b) => {
    if (!sortKey) return 0; // if no sort key selected, do not sort
    if (a[sortKey] < b[sortKey]) return sortOrder === 'asc' ? -1 : 1;
    if (a[sortKey] > b[sortKey]) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Outside mouse-move effect to detect when user leaves the table area
  useEffect(() => {
    function handleOutsideMove(event) {
      if (
        menuRef.current &&
        (!menuRef.current.contains(event.target) ||
          menuRef.current === event.target)
      ) {
        setIsDown(false);
      }
    }

    function handleOutsideClick(event) {
      if (menuRef.current === event.target) {
        handleActiveChange(null);
      }
    }

    document.addEventListener('mousemove', handleOutsideMove);
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('mousemove', handleOutsideMove);
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [handleActiveChange]);

  useEffect(() => {
    if(disallowSelection) setActive(null);
  }, [disallowSelection]);

  return (<div className="table-wrapper" ref={menuRef}>
    <table cellPadding="0">
      <thead>
        <tr>
          {columns.map((col, index) => (
            <th key={index} onClick={() => handleSort(col.key)}>
              <span>{col.label}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sortedData.map((row, rowIndex) => (
          <tr
            key={rowIndex}
            className={active === rowIndex ? 'active' : ''}
            // Mouse / touch events
            onMouseDown={() => {
              setIsDown(true);
              handleActiveChange(rowIndex);
            }}
            onMouseMove={() => {
              if (isDown) handleActiveChange(rowIndex);
            }}
            onMouseUp={() => {
              setIsDown(false);
              handleActiveChange(rowIndex);
            }}
            onTouchStart={() => {
              setIsDown(true);
              handleActiveChange(rowIndex);
            }}
            onTouchMove={() => {
              if (isDown) handleActiveChange(rowIndex);
            }}
            onTouchEnd={() => {
              setIsDown(false);
              handleActiveChange(rowIndex);
            }}
          >
            {columns.map((col, colIndex) => {
              // If the column definition includes a custom render function, use it
              if (typeof col.render === 'function') {
                return (
                  <td key={colIndex}>
                    {col.render(row)}
                  </td>
                );
              }
              // Otherwise, just show the raw cell data
              return <td key={col.key}>{row[col.key]}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  </div>);
}

