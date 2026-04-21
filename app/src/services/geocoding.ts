import type { GeocodingResult } from '@/types/imagery';

const API_BASE = 'http://localhost:8000/api';

export async function geocodeRegion(query: string): Promise<GeocodingResult[]> {
  const res = await fetch(`${API_BASE}/imagery/geocode?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  return res.json();
}

export interface OsmGeocodingResult {
  placeId: string;
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
  boundingBox: [number, number, number, number]; // [south, north, west, east]
  type: string;
  importance: number;
}

export async function osmGeocodeRegion(query: string): Promise<OsmGeocodingResult[]> {
  if (!query || query.trim() === "") return [];

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.append("q", query);
    url.searchParams.append("format", "json");
    url.searchParams.append("limit", "5");
    url.searchParams.append("polygon_geojson", "1"); // helps accurately capture region boundaries

    const response = await fetch(url.toString(), {
      headers: { "User-Agent": "GriidAiReferralApp/1.0" },
    });

    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.statusText}`);
    }

    const data = await response.json();

    return data.map((item: any) => ({
      placeId: item.place_id,
      name: item.name || item.display_name.split(",")[0],
      displayName: item.display_name,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      boundingBox: [
        parseFloat(item.boundingbox[0]), // south
        parseFloat(item.boundingbox[1]), // north
        parseFloat(item.boundingbox[2]), // west
        parseFloat(item.boundingbox[3]), // east
      ],
      type: item.type,
      importance: item.importance || 0,
    }));
  } catch (error) {
    console.error("Geocoding error:", error);
    throw error;
  }
}
