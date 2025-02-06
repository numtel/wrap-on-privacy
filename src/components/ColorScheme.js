import { useState } from 'react';

import Dialog from './Dialog.js';
import GenericSortableTable from './SortableTable.js';

import { downloadTextFile } from '../utils.js';

export default function ColorScheme({ sesh, setShowColorScheme, showColorScheme, setRefreshStatus }) {
  const [updateCount, setUpdateCount] = useState(0);
  const [curColor, setCurColor] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);

  function handleRowSelection(row) {
    if (row !== null) {
      const key = Object.keys(sesh.colorScheme)[row];
      setSelectedIndex(key);
      setCurColor(sesh.colorScheme[key] || '');
    } else {
      setCurColor(null);
      setSelectedIndex(null);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (selectedIndex === null) return;

    sesh.colorScheme[selectedIndex] = curColor || null;
    sesh.saveToLocalStorage();
    setUpdateCount(updateCount + 1);
    setRefreshStatus(x => x+1);
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
          const importedScheme = JSON.parse(event.target.result);
          sesh.colorScheme = importedScheme;
          sesh.saveToLocalStorage();
          setUpdateCount(x => x + 1);
          setRefreshStatus(x => x+1);
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

  function handleReset() {
    for(let key of Object.keys(sesh.colorScheme)) {
      sesh.colorScheme[key] = null;
    }
    sesh.saveToLocalStorage();
    setUpdateCount(x => x + 1);
    setRefreshStatus(x => x+1);
  }

  function handleExport() {
    downloadTextFile(JSON.stringify(sesh.colorScheme, null, 2), 'color-scheme.json');
  }

  return (
    <Dialog show={showColorScheme} setShow={setShowColorScheme}>
      <h2>Color Scheme</h2>
      <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
        <div className="flex flex-col space-y-4">
          <div className="controls">
            <button className="button" onClick={handleImport}>
              Import...
            </button>
            <button className="button" onClick={handleExport}>
              Export
            </button>
            <button className="button" onClick={handleReset}>
              Reset
            </button>
          </div>
          <GenericSortableTable
            onActiveChange={handleRowSelection}
            columns={[{ key: 'name', label: 'Property Name' }]}
            data={Object.keys(sesh.colorScheme).map(x=>({name: x}))}
          />
        </div>
        <form onSubmit={handleSubmit}>
          <fieldset>
            <legend>Details</legend>
            <label className="text">
              <span>Color:</span>
              <ColorPicker
                value={curColor}
                setValue={setCurColor}
                disabled={selectedIndex === null}
              />
            </label>
          </fieldset>
          <div className="controls">
            <button disabled={selectedIndex === null} className="button">
              Save
            </button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}

const ColorPicker = ({ value, setValue, disabled }) => {
  const handleColorChange = (event) => {
    setValue(event.target.value);
  };

  return (
    <div className="flex flex-col items-center gap-2 p-4">
      <input
        {...{disabled}}
        type="color"
        value={value}
        onChange={handleColorChange}
        className="w-16 h-16 cursor-pointer"
      />
      <input
        {...{disabled}}
        type="text"
        value={value}
        onChange={handleColorChange}
        className="border p-1 text-center rounded-md"
      />
    </div>
  );
};
