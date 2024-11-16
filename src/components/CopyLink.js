import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { DocumentDuplicateIcon, CheckIcon } from '@heroicons/react/24/outline';

const CopyLink = ({ text, hideText, className }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    setClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Revert to clipboard icon after 2 seconds
  };

  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      className={`flex items-center space-x-2 hover:underline ${className}`}
    >
      {!hideText && <span>{text}</span>}
      {copied ? (
        <CheckIcon className="h-5 w-5 text-green-100" />
      ) : (
        <DocumentDuplicateIcon className="h-5 w-5 text-white" />
      )}
    </button>
  );
};

export default CopyLink;

async function setClipboard(text) {
  if (!navigator.clipboard) {
    toast.error('Clipboard API is not available in this browser.');
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  } catch (err) {
    toast.error('Failed to copy to clipboard');
  }
}
