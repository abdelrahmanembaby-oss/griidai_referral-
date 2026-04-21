/**
 * Export API client – talks to /api/export endpoints
 */
import { apiFetch, getApiUrl } from './client';
import type {
  ExportRequest,
  ExportAccepted,
  ExportStatusResponse,
  FormatGroups,
} from '@/types/export';

/** POST /api/export – enqueue a conversion job */
export async function requestExport(body: ExportRequest): Promise<ExportAccepted> {
  return apiFetch<ExportAccepted>('/api/export', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** POST /api/export/upload – enqueue an export job from an uploaded file */
export async function uploadAndExport(file: File, targetFormat: string): Promise<ExportAccepted> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('target_format', targetFormat);
  
  const url = getApiUrl('/api/export/upload');
  const authCookie = document.cookie.split('; ').find(row => row.startsWith('auth_token='));
  const token = authCookie ? authCookie.split('=')[1] : localStorage.getItem('auth_token');
  
  const headers: HeadersInit = {
    ...(token && { Authorization: `Bearer ${token}` })
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData, // browser automatically sets multipart/form-data boundary
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `HTTP error ${response.status}`);
  }

  return response.json();
}

/** GET /api/export/status?task_id=… – poll job status */
export async function getExportStatus(taskId: string): Promise<ExportStatusResponse> {
  return apiFetch<ExportStatusResponse>(`/api/export/status?task_id=${taskId}`);
}

/** GET /api/export/formats – list available formats */
export async function getExportFormats(): Promise<FormatGroups> {
  return apiFetch<FormatGroups>('/api/export/formats');
}

/** Build the full download URL for a completed export */
export function getExportDownloadUrl(taskId: string): string {
  return getApiUrl(`/api/export/download?task_id=${taskId}`);
}
