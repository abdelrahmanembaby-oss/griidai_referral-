import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Rectangle,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { LeafletMouseEvent } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { BoundingBox, OsmLayer } from "../../types/osm";

// Fix for default Leaflet icon paths in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface OsmMapProps {
  bbox: BoundingBox | null;
  clipBbox: BoundingBox | null;
  layers: (OsmLayer & { data?: GeoJSON.FeatureCollection })[];
  onDrawBbox: (bbox: BoundingBox) => void;
  onClipBbox: (bbox: BoundingBox | null) => void;
  mode: "pan" | "select" | "clip";
}

const MIN_DRAG_DEG = 0.005;

/* ── Custom Rectangle Drawing Hook ── */
function DrawRectangleHandler({
  mode,
  onDrawBbox,
  onClipBbox,
}: {
  mode: "pan" | "select" | "clip";
  onDrawBbox: (bbox: BoundingBox) => void;
  onClipBbox: (bbox: BoundingBox | null) => void;
}) {
  const map = useMap();
  const startRef = useRef<L.LatLng | null>(null);
  const drawingRef = useRef(false);
  const [tempBounds, setTempBounds] = useState<L.LatLngBounds | null>(null);

  /* Disable panning when drawing */
  useEffect(() => {
    if (mode === "select" || mode === "clip") {
      map.dragging.disable();
      map.getContainer().style.cursor = "crosshair";
    } else {
      map.dragging.enable();
      map.getContainer().style.cursor = "grab";
      setTempBounds(null);
    }
  }, [mode, map]);

  useMapEvents({
    mousedown(e: LeafletMouseEvent) {
      if (mode === "pan") return;
      startRef.current = e.latlng;
      drawingRef.current = true;
      setTempBounds(null);
    },
    mousemove(e: LeafletMouseEvent) {
      if (mode === "pan" || !drawingRef.current || !startRef.current) return;
      const newBounds = L.latLngBounds(startRef.current, e.latlng);
      setTempBounds(newBounds);
    },
    mouseup(e: LeafletMouseEvent) {
      if (mode === "pan" || !drawingRef.current || !startRef.current) return;
      drawingRef.current = false;

      const dLat = Math.abs(e.latlng.lat - startRef.current.lat);
      const dLng = Math.abs(e.latlng.lng - startRef.current.lng);

      if (dLat < MIN_DRAG_DEG && dLng < MIN_DRAG_DEG) {
        startRef.current = null;
        setTempBounds(null);
        return;
      }

      const finalBounds = L.latLngBounds(startRef.current, e.latlng);
      const bboxParams = {
        south: finalBounds.getSouth(),
        north: finalBounds.getNorth(),
        west: finalBounds.getWest(),
        east: finalBounds.getEast(),
      };

      if (mode === "select") {
        onDrawBbox(bboxParams);
      } else if (mode === "clip") {
        onClipBbox(bboxParams);
      }

      startRef.current = null;
      setTempBounds(null);
    },
  });

  return tempBounds ? (
    <Rectangle
      bounds={tempBounds}
      pathOptions={{
        color: mode === "select" ? "#3b82f6" : "#10b981",
        weight: 2,
        fillColor: mode === "select" ? "#3b82f6" : "#10b981",
        fillOpacity: 0.2,
        dashArray: "6 4",
      }}
    />
  ) : null;
}

function BboxUpdater({ bbox, clipBbox }: { bbox: BoundingBox | null, clipBbox: BoundingBox | null }) {
  const map = useMap();
  useEffect(() => {
    if (bbox) {
      const bounds = L.latLngBounds(
        L.latLng(bbox.south, bbox.west),
        L.latLng(bbox.north, bbox.east)
      );
      // Only flyTo if clipBbox is not set (don't jump map when clipping)
      if (!clipBbox) {
         map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5 });
      }
    }
  }, [bbox, map, clipBbox]);
  return null;
}

export function OsmMap({ bbox, clipBbox, layers, onDrawBbox, onClipBbox, mode }: OsmMapProps) {
  const [mapReady, setMapReady] = useState(false);

  const getStyleForFeature = (feature: any) => {
    const layerId = feature.properties?._layerId;
    const layerInfo = layers.find(l => l.id === layerId);
    
    return {
      color: layerInfo?.color || "#e11d48",
      weight: feature.geometry.type === "LineString" ? 2 : 1.5,
      opacity: 0.8,
      fillColor: layerInfo?.color || "#e11d48",
      fillOpacity: 0.35,
    };
  };

  const onEachFeature = (feature: any, layer: L.Layer) => {
    if (feature.properties) {
      const tags = feature.properties.tags || feature.properties;
      const name = tags.name || tags["name:en"] || "Unnamed Feature";
      const type = feature.properties.type || feature.geometry.type;
      
      const popupContent = `
        <div class="text-sm">
          <strong class="block mb-1 border-b pb-1 text-slate-800">${name}</strong>
          <div class="text-xs text-slate-600">
            <span class="font-semibold">Type:</span> ${type}
            ${tags.highway ? '<br/><span class="font-semibold">Highway:</span> ' + tags.highway : ""}
            ${tags.building ? '<br/><span class="font-semibold">Building:</span> ' + tags.building : ""}
            ${tags.amenity ? '<br/><span class="font-semibold">Amenity:</span> ' + tags.amenity : ""}
            ${tags.natural ? '<br/><span class="font-semibold">Natural:</span> ' + tags.natural : ""}
          </div>
        </div>
      `;
      layer.bindPopup(popupContent);
    }
  };

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer
        center={[30.0444, 31.2357]} // Cairo default
        zoom={12}
        className="w-full h-full bg-slate-900"
        whenReady={() => setMapReady(true)}
        dragging={mode === "pan"}
      >
        <TileLayer
          // Using a dark CartoDB tile layer to match dark-mode software
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        <BboxUpdater bbox={bbox} clipBbox={clipBbox} />

        <DrawRectangleHandler mode={mode} onDrawBbox={onDrawBbox} onClipBbox={onClipBbox} />

        {/* Primary Selected Region bounds */}
        {bbox && mode !== "select" && (
          <Rectangle
            bounds={[
              [bbox.south, bbox.west],
              [bbox.north, bbox.east],
            ]}
            pathOptions={{ color: "#3b82f6", weight: 2, fillOpacity: 0.05, dashArray: "5, 5" }}
          />
        )}

        {/* Clipped sub-region bounds */}
        {clipBbox && mode !== "clip" && (
          <Rectangle
            bounds={[
              [clipBbox.south, clipBbox.west],
              [clipBbox.north, clipBbox.east],
            ]}
            pathOptions={{ color: "#10b981", weight: 2, fillOpacity: 0.1, dashArray: "10, 5" }}
          />
        )}

        {mapReady && layers.map((layer) => (
          layer.data ? (
            <GeoJSON
              key={`${layer.id}-${layer.data.features.length}`}
              data={layer.data}
              style={getStyleForFeature}
              onEachFeature={onEachFeature}
            />
          ) : null
        ))}
      </MapContainer>
      
      {mode !== "pan" && (
        <div className="absolute bottom-6 right-6 z-[400] bg-card text-card-foreground border border-border px-3 py-2 rounded-md shadow-lg flex items-center gap-2 pointer-events-none">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: mode === "select" ? "#3b82f6" : "#10b981" }} />
          <span className="text-xs font-semibold tracking-wide">
            {mode === "select" ? "DRAW BASE REGION" : "DRAW CLIP AREA"}
          </span>
        </div>
      )}
    </div>
  );
}
