// src/types/osm.ts
export interface BoundingBox {
  south: number; // min lat
  north: number; // max lat
  west: number;  // min lon
  east: number;  // max lon
}

export interface OsmLayer {
  id: string;
  name: string;
  color: string;
  query: string;
  visible: boolean;
  selected: boolean;
}

export interface PolygonGeometry {
  type: string;
  coordinates: any[];
}

export interface OsmFeature {
  id: string;
  type: "node" | "way" | "relation";
  tags: Record<string, string>;
  geometry?: PolygonGeometry;
  layerId: string;
}

export const DEFAULT_OSM_LAYERS: OsmLayer[] = [
  { id: "buildings", name: "Buildings", color: "#e11d48", query: 'way["building"];relation["building"];', visible: true, selected: false },
  { id: "highways", name: "Roads & Highways", color: "#f59e0b", query: 'way["highway"];', visible: true, selected: false },
  { id: "water", name: "Water Bodies", color: "#3b82f6", query: 'way["natural"="water"];relation["natural"="water"];way["waterway"];', visible: true, selected: false },
  { id: "landuse", name: "Land Use (Residential, Comm.)", color: "#8b5cf6", query: 'way["landuse"];relation["landuse"];', visible: true, selected: false },
  { id: "leisure", name: "Leisure & Parks", color: "#10b981", query: 'way["leisure"];relation["leisure"];way["natural"="wood"];', visible: true, selected: false },
  { id: "amenity", name: "Amenities (Schools, Hosp, etc)", color: "#06b6d4", query: 'node["amenity"];way["amenity"];relation["amenity"];', visible: true, selected: false },
  { id: "railway", name: "Railways", color: "#64748b", query: 'way["railway"];', visible: true, selected: false },
  { id: "power", name: "Power Lines & Infrastructure", color: "#fb923c", query: 'node["power"];way["power"];', visible: true, selected: false },
];
