export interface ImageryResult {
  entityId: string;
  displayId: string;
  acquisitionDate: string;
  cloudCover: number;
  browseUrl: string | null;
  spatialBounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  sensor: string;
  dataset: string;
}

export interface SearchFilters {
  south: number;
  north: number;
  west: number;
  east: number;
  startDate: string;
  endDate: string;
  maxCloudCover: number;
  dataset?: string;
  maxResults?: number;
  startingNumber?: number;
}

export interface USGSSearchResponse {
  results: ImageryResult[];
  totalHits: number;
  error?: string;
}

export interface GeocodingResult {
  displayName: string;
  lat: number;
  lon: number;
  boundingBox: [number, number, number, number]; // [south, north, west, east]
}
