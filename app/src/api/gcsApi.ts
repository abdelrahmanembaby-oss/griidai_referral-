/**
 * GCS Bucket Files API client – talks to /api/gcs/* endpoints
 */
import { apiFetch, getApiUrl } from './client';

// ─── Types ──────────────────────────────────────────────────────────────────
export interface GcsFileItem {
  name: string;
  full_path: string;
  gcs_uri: string;
  size_bytes: number;
  file_type: 'raster' | 'vector' | 'unknown';
  updated: string | null;
}

export interface GcsFilesResponse {
  bucket: string;
  prefix: string;
  files: GcsFileItem[];
}

export interface BatchExportAccepted {
  job_id: string;
  job_name: string;
  gcs_output: string;
  status: string;
  message: string;
}

export interface BatchExportStatusResponse {
  job_id: string;
  status: string;
  gcs_output: string;
  download_url: string | null;
  message: string;
}

// ─── API Calls ──────────────────────────────────────────────────────────────

/** GET /api/gcs/files – list files in a GCS bucket */
export async function listGcsFiles(
  bucket?: string,
  prefix?: string,
): Promise<GcsFilesResponse> {
  const params = new URLSearchParams();
  if (bucket) params.set('bucket', bucket);
  if (prefix) params.set('prefix', prefix);
  const qs = params.toString();
  return apiFetch<GcsFilesResponse>(`/api/gcs/files${qs ? `?${qs}` : ''}`);
}

/** GET /api/gcs/exports – list uncompressed exported result files */
export async function listGcsExports(): Promise<GcsFilesResponse> {
  return apiFetch<GcsFilesResponse>('/api/gcs/exports');
}

/** GET /api/gcs/download-url – get a signed download URL for a GCS file */
export async function getGcsDownloadUrl(
  gcsUri: string,
): Promise<{ download_url: string; gcs_uri: string; filename: string }> {
  return apiFetch(`/api/gcs/download-url?gcs_uri=${encodeURIComponent(gcsUri)}`);
}

export async function submitBatchExport(
  gcsUri: string,
  targetFormat: string,
  targetCrs?: number,
): Promise<BatchExportAccepted> {
  return apiFetch<BatchExportAccepted>('/api/gcs/batch-export', {
    method: 'POST',
    body: JSON.stringify({
      gcs_uri: gcsUri,
      target_format: targetFormat,
      ...(targetCrs && { target_crs: targetCrs }),
    }),
  });
}

/** GET /api/gcs/batch-export/status – poll batch export job status */
export async function getBatchExportStatus(
  jobId: string,
): Promise<BatchExportStatusResponse> {
  return apiFetch<BatchExportStatusResponse>(
    `/api/gcs/batch-export/status?job_id=${encodeURIComponent(jobId)}`,
  );
}

/** Trigger browser download directly to user's device (never opens in browser) */
export async function triggerDownload(url: string, filename: string) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    }, 100);
  } catch (err) {
    // Fallback: open in new tab if fetch fails (e.g. CORS)
    window.open(url, '_blank');
  }
}

/**
 * Upload a file directly to the configured GCS bucket.
 */
export const uploadGcsFile = async (file: File): Promise<any> => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(getApiUrl('/api/gcs/upload'), {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    let errDetail = 'Failed to upload file to GCS';
    try {
      const errData = await response.json();
      errDetail = errData.detail || errDetail;
    } catch (e) {}
    throw new Error(errDetail);
  }
  
  return response.json();
};

/**
 * Upload a raw OSM file to the configured GCS bucket under osm_raw/.
 */
export const uploadRawOsm = async (file: File): Promise<any> => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(getApiUrl('/api/gcs/upload-raw-osm'), {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    let errDetail = 'Failed to upload OSM file to GCS';
    try {
      const errData = await response.json();
      errDetail = errData.detail || errDetail;
    } catch (e) {}
    throw new Error(errDetail);
  }
  
  return response.json();
};
