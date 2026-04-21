import type { SearchFilters, USGSSearchResponse } from '@/types/imagery';

const API_BASE = 'http://localhost:8000/api';

export async function searchImagery(filters: SearchFilters): Promise<USGSSearchResponse> {
  const res = await fetch(`${API_BASE}/imagery/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filters),
  });
  if (!res.ok) throw new Error(`Imagery search failed: ${res.status}`);
  return res.json();
}

export interface DownloadItem {
  url: string;
  productName: string;
  filesize?: number;
  headers?: Record<string, string>;   // auth headers for Copernicus
}

export interface DownloadResponse {
  downloads: DownloadItem[];
  error?: string;
}

export async function downloadScene(
  entityId: string,
  dataset: string,
  provider: string = 'usgs',
): Promise<DownloadResponse> {
  const res = await fetch(`${API_BASE}/imagery/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entityId, dataset, provider }),
  });
  if (!res.ok) throw new Error(`Download request failed: ${res.status}`);
  return res.json();
}

export interface CopernicusBandInfo {
  name: string;
  fullName: string;
  resolution: string;
  nodePath: string;
  size: number;
}

export interface CopernicusBandsResponse {
  productId: string;
  productName: string;
  bands: CopernicusBandInfo[];
  error?: string;
}

export async function fetchCopernicusBands(productId: string): Promise<CopernicusBandsResponse> {
  const res = await fetch(`${API_BASE}/imagery/copernicus/bands/${productId}`);
  if (!res.ok) throw new Error(`Bands request failed: ${res.status}`);
  return res.json();
}
