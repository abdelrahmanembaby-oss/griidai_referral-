import type { SearchFilters, USGSSearchResponse } from '@/types/imagery';

const API_BASE = 'http://localhost:8000/api';

export async function searchImagery(filters: SearchFilters): Promise<USGSSearchResponse> {
  const res = await fetch(`${API_BASE}/imagery/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filters),
  });
  if (!res.ok) throw new Error(`USGS search failed: ${res.status}`);
  return res.json();
}

export interface DownloadItem {
  url: string;
  productName: string;
  filesize?: number;
}

export interface DownloadResponse {
  downloads: DownloadItem[];
  error?: string;
}

export async function downloadScene(entityId: string, dataset: string): Promise<DownloadResponse> {
  const res = await fetch(`${API_BASE}/imagery/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entityId, dataset }),
  });
  if (!res.ok) throw new Error(`Download request failed: ${res.status}`);
  return res.json();
}
