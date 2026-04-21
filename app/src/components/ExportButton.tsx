/**
 * ExportButton – triggers the ExportModal
 */
import { useState } from 'react';
import { ExportModal } from './ExportModal';
import { DownloadIcon } from 'lucide-react'; // assuming lucide-react or similar

interface ExportButtonProps {
  fileId: string;
  sourceUrl?: string;
  provider?: string;
  className?: string;
  variant?: 'outline' | 'ghost' | 'default';
}

export function ExportButton({ fileId, sourceUrl, provider, className = '', variant = 'outline' }: ExportButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);

  // Simple button styling based on variant
  const baseClass = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2";
  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    ghost: "hover:bg-accent hover:text-accent-foreground",
  };

  return (
    <>
      <button 
        className={`${baseClass} ${variants[variant]} ${className}`}
        onClick={() => setModalOpen(true)}
      >
        <DownloadIcon className="mr-2 h-4 w-4" />
        Export As...
      </button>
      
      <ExportModal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
        fileId={fileId}
        sourceUrl={sourceUrl}
        provider={provider}
      />
    </>
  );
}
