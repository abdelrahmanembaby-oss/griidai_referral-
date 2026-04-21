const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

export interface UploadedFile {
  filename: string;
  path: string;
  size_bytes: number;
  file_type: "raster" | "vector" | "unknown";
  extension: string;
}

export interface ExportTask {
  task_id: string;
  status: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILURE";
  progress: number;
  message: string;
  download_url: string | null;
}

export async function uploadGisFile(file: File): Promise<UploadedFile> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Upload failed");
  }

  const data = await res.json();
  return data.file as UploadedFile;
}

export async function listUploadedFiles(): Promise<UploadedFile[]> {
  const res = await fetch(`${API_BASE}/uploads`);
  if (!res.ok) throw new Error("Failed to fetch uploaded files");
  return res.json();
}

export async function deleteUploadedFile(filename: string): Promise<void> {
  const res = await fetch(`${API_BASE}/uploads/${encodeURIComponent(filename)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete file");
}

export async function startExport(
  filePath: string,
  targetFormat: string,
  targetCrs?: number
): Promise<string> {
  const res = await fetch(`${API_BASE}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file_id: filePath,
      target_format: targetFormat,
      provider: "local",
      ...(targetCrs && { target_crs: targetCrs }),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Export failed to start");
  }
  const data = await res.json();
  return data.task_id as string;
}

export async function pollExportStatus(taskId: string): Promise<ExportTask> {
  const res = await fetch(`${API_BASE}/export/status?task_id=${taskId}`);
  if (!res.ok) throw new Error("Failed to poll export status");
  return res.json();
}
