import { useRef, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/16/solid';

export default function Dialog({ title, show, setShow, children, className, noClose }) {
  const elRef = useRef();

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape') {
        setShow(false);
      }
    }

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    const dialog = elRef.current;

    // Sync dialog state with show prop
    if (show && !dialog.open) {
      dialog.show();
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

  return (
    <dialog {...{className}} ref={elRef}>
      {noClose ? children : (
        <div className="content">
          {title && (
            <h2>
              {title}
              {!noClose && setShow && <button className="button close" onClick={() => setShow(false)}>
                <XMarkIcon className="h-5 w-5 inline-block" />
              </button>}
            </h2>
          )}
          {children}
        </div>
      )}
    </dialog>
  );
}
