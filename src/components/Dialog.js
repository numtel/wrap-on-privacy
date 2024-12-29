import { useRef, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/16/solid';

export default function Dialog({ show, setShow, children }) {
  const elRef = useRef();

  useEffect(() => {
    const dialog = elRef.current;

    // Sync dialog state with show prop
    if (show && !dialog.open) {
      dialog.showModal();
    } else if (!show && dialog.open) {
      dialog.close();
    }

    // Handle closing the dialog
    const handleClose = () => {
      setShow(false);
    };

    dialog.addEventListener('close', handleClose);

    return () => {
      dialog.removeEventListener('close', handleClose);
    };
  }, [show, setShow]);

  const handleBackdropClick = (e) => {
    if (e.target === elRef.current) {
      setShow(false);
    }
  };

  return (
    <dialog ref={elRef} onClick={handleBackdropClick}>
      {setShow && <button className="button close" onClick={() => setShow(false)}>
        <XMarkIcon className="h-5 w-5 inline-block align-top" />
      </button>}
      {children}
    </dialog>
  );
}
