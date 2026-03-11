import { FileText, Paperclip, Wrench, ClipboardList } from 'lucide-react';

export function RightToolbar() {
  const tools = [
    { icon: FileText, label: 'Files' },
    { icon: Paperclip, label: 'Attachments' },
    { icon: Wrench, label: 'Tools' },
    { icon: ClipboardList, label: 'Tasks' },
  ];

  return (
    <div className="right-toolbar">
      {tools.map((t) => (
        <button key={t.label} className="right-toolbar-btn" title={t.label}>
          <t.icon size={18} />
        </button>
      ))}
    </div>
  );
}
