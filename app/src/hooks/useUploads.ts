import { useState, useCallback, useEffect } from "react";
import {
  uploadGisFile,
  listUploadedFiles,
  deleteUploadedFile,
  startExport,
  pollExportStatus,
  type UploadedFile,
} from "@/services/gisUpload";
import { toast } from "sonner";

export function useUploads() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [exportingFile, setExportingFile] = useState<string | null>(null);

  const refreshList = useCallback(async () => {
    try {
      const data = await listUploadedFiles();
      setFiles(data);
    } catch (e) {
      console.error("Failed to list uploads:", e);
    }
  }, []);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  const handleUpload = useCallback(
    async (file: File) => {
      setIsLoading(true);
      try {
        await uploadGisFile(file);
        toast.success(`Upload successful: ${file.name}`);
        await refreshList();
      } catch (e: any) {
        toast.error(`Upload failed: ${e.message}`);
      } finally {
        setIsLoading(false);
      }
    },
    [refreshList]
  );

  const handleDelete = useCallback(
    async (filename: string) => {
      try {
        await deleteUploadedFile(filename);
        toast.success(`File deleted: ${filename}`);
        await refreshList();
      } catch (e: any) {
        toast.error(`Delete failed: ${e.message}`);
      }
    },
    [refreshList]
  );

  const handleExport = useCallback(
    async (file: UploadedFile, targetFormat: string, targetCrs?: number) => {
      setExportingFile(file.filename);
      try {
        const taskId = await startExport(file.path, targetFormat, targetCrs);
        toast(`Export started: Converting ${file.filename}…`);

        // Poll until done
        const poll = async (): Promise<void> => {
          const status = await pollExportStatus(taskId);
          if (status.status === "SUCCESS" && status.download_url) {
            // Trigger browser download
            const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";
            window.open(apiBase.replace("/api", "") + status.download_url, "_blank");
            toast.success(`Export complete! ${file.filename} → ${targetFormat}`);
            setExportingFile(null);
          } else if (status.status === "FAILURE") {
            toast.error(`Export failed: ${status.message}`);
            setExportingFile(null);
          } else {
            // Still processing — poll again in 1.5 s
            setTimeout(poll, 1500);
          }
        };
        await poll();
      } catch (e: any) {
        toast.error(`Export error: ${e.message}`);
        setExportingFile(null);
      }
    },
    []
  );

  return {
    files,
    isLoading,
    exportingFile,
    handleUpload,
    handleDelete,
    handleExport,
    refreshList,
  };
}
