import type { GeocodingResult } from '@/types/imagery';

const API_BASE = 'http://localhost:8000/api';

export async function geocodeRegion(query: string): Promise<GeocodingResult[]> {
  const res = await fetch(`${API_BASE}/imagery/geocode?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  return res.json();
}
