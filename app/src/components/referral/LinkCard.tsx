import React from "react";
import { ClipboardDocumentIcon, ShareIcon } from "@heroicons/react/outline";

interface Props {
  link: string;
}

const LinkCard: React.FC<Props> = ({ link }) => {
  const copy = () => {
    navigator.clipboard.writeText(link);
  };
  return (
    <div className="bg-white shadow rounded p-4 flex items-center justify-between">
      <div className="truncate">{link}</div>
      <div className="flex space-x-2">
        <button onClick={copy} className="p-2 hover:bg-gray-100 rounded">
          <ClipboardDocumentIcon className="h-5 w-5" />
        </button>
        <button
          onClick={() => navigator.share?.({ url: link })}
          className="p-2 hover:bg-gray-100 rounded"
        >
          <ShareIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default LinkCard;
