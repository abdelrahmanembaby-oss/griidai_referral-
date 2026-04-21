import osmtogeojson from "osmtogeojson";
import type { BoundingBox, OsmLayer } from "../types/osm";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter"
];

// Simple LRU Cache to avoid redundant requests to OSM
const osmCache = new Map<string, GeoJSON.FeatureCollection>();
const MAX_CACHE_SIZE = 15;

/**
 * Builds an Overpass QL query strictly for the bounding box.
 */
function buildOverpassQuery(bbox: BoundingBox, layerInfo: OsmLayer): string {
  const { south, north, west, east } = bbox;
  // Overpass bbox format: (south, west, north, east)
  const bboxString = `${south},${west},${north},${east}`;

  // Replace semicolons with the bounding box context for each query part
  const queryParts = layerInfo.query
    .split(";")
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(part => `${part}(${bboxString});`);

  return `
    [out:json][timeout:25];
    (
      ${queryParts.join("\n      ")}
    );
    out body;
    >;
    out skel qt;
  `;
}

export async function fetchOsmData(bbox: BoundingBox, layerInfo: OsmLayer): Promise<GeoJSON.FeatureCollection> {
  const cacheKey = `${layerInfo.id}_${bbox.south}_${bbox.west}_${bbox.north}_${bbox.east}`;
  
  if (osmCache.has(cacheKey)) {
    // LRU: delete and re-insert to mark as most recently used
    const cachedData = osmCache.get(cacheKey)!;
    osmCache.delete(cacheKey);
    osmCache.set(cacheKey, cachedData);
    console.log(`[Cache Hit] Returning cached data for ${layerInfo.name} in bbox`, bbox);
    return cachedData;
  }

  const query = buildOverpassQuery(bbox, layerInfo);
  let lastError: any = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: `data=${encodeURIComponent(query)}`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        let errorText = response.statusText;
        try {
          const text = await response.text();
          const match = text.match(/<p><strong.*?>(.*?)<\/strong><\/p>/);
          if (match && match[1]) {
             errorText = match[1].replace(/&quot;/g, '"');
          } else {
             errorText = text.substring(0, 150);
          }
        } catch (e) {}
        
        // Throw an error to be caught by the retry loop
        throw new Error(`Failed to fetch OSM data (${response.status}): ${errorText}`);
      }

      const osmJson = await response.json();
      
      if (osmJson.remark && osmJson.remark.includes("runtime error")) {
        throw new Error(`Overpass Query Error: ${osmJson.remark}`);
      }
      
      const geojson = osmtogeojson(osmJson) as GeoJSON.FeatureCollection;
      
      // Attach the layer ID to properties to keep track of colors later
      geojson.features = geojson.features.map(f => ({
        ...f,
        properties: {
          ...f.properties,
          _layerId: layerInfo.id
        }
      }));

      // Cache the successful result
      if (osmCache.size >= MAX_CACHE_SIZE) {
        const firstKey = osmCache.keys().next().value;
        if (firstKey !== undefined) {
          osmCache.delete(firstKey);
        }
      }
      osmCache.set(cacheKey, geojson);

      return geojson;
      
    } catch (error: any) {
      console.warn(`Overpass API ${endpoint} failed:`, error);
      lastError = error;
      // If it's a timeout or 400 Bad Request, there's no point in retrying other endpoints
      if (error.message.includes("Overpass Query Error") || error.message.includes("(400)")) {
        throw error;
      }
      // Otherwise, loop to the next endpoint for 504, 502, 429, etc.
    }
  }

  // If all endpoints failed
  throw new Error(lastError?.message || "All Overpass API endpoints failed to respond.");
}
