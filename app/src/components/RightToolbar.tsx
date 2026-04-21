import { useState, useRef } from 'react';
import { Folder, Paperclip, Wrench, Wand2, MessageSquare, Loader2 } from 'lucide-react';
import { UploadExportModal } from './UploadExportModal';
import { GcsBucketSidebar } from './GcsBucketSidebar';
import { uploadGcsFile } from '../api/gcsApi';

export function RightToolbar() {
  const [modalOpen, setModalOpen] = useState(false);
  const [gcsSidebarOpen, setGcsSidebarOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      await uploadGcsFile(file);
      window.dispatchEvent(new CustomEvent('gcs-bucket-changed'));
      setGcsSidebarOpen(true); // Open the sidebar to show the new file
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const tools = [
    { icon: Folder, label: 'Data Catalog', onClick: () => setGcsSidebarOpen(true), isActive: gcsSidebarOpen },
    { icon: isUploading ? Loader2 : Paperclip, label: 'Upload to Bucket', onClick: handleUploadClick, isSpinning: isUploading },
    { icon: Wrench, label: 'Tools', onClick: () => setModalOpen(true) },
    { icon: Wand2, label: 'Magic' },
    { icon: MessageSquare, label: 'Chat' },
  ];

  return (
    <>
      <div className="right-toolbar">
        {tools.map((t) => (
          <button
            key={t.label}
            className={`right-toolbar-btn ${t.isActive ? 'active' : ''}`}
            title={t.label}
            onClick={t.onClick}
            disabled={t.isSpinning}
          >
            <t.icon size={20} className={`${t.isActive ? 'text-white' : 'text-slate-500'} ${t.isSpinning ? 'gcs-spin' : ''}`} />
          </button>
        ))}
      </div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <UploadExportModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <GcsBucketSidebar open={gcsSidebarOpen} onClose={() => setGcsSidebarOpen(false)} />
    </>
  );
}
