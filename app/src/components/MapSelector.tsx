import { useState, useCallback, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Rectangle, useMapEvents, useMap } from 'react-leaflet';
import type { LatLngBounds, LeafletMouseEvent } from 'leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, X, Check, RotateCcw, Pencil, Move } from 'lucide-react';

/* ── Types ── */
export interface BBox {
  south: number;
  north: number;
  west: number;
  east: number;
}

interface MapSelectorProps {
  onConfirm: (bbox: BBox) => void;
  onClose: () => void;
  initialBounds?: BBox | null;
}

/* minimum degrees a user must drag to form a valid rectangle */
const MIN_DRAG_DEG = 0.01;

/* ── Rectangle-Drawing inner component ── */
function DrawRectangle({
  bounds,
  setBounds,
  isDrawMode,
}: {
  bounds: LatLngBounds | null;
  setBounds: (b: LatLngBounds | null) => void;
  isDrawMode: boolean;
}) {
  const startRef = useRef<L.LatLng | null>(null);
  const drawingRef = useRef(false);
  const map = useMap();

  /* Toggle dragging based on draw mode */
  useEffect(() => {
    if (isDrawMode) {
      map.dragging.disable();
      map.getContainer().style.cursor = 'crosshair';
    } else {
      map.dragging.enable();
      map.getContainer().style.cursor = 'grab';
    }
  }, [isDrawMode, map]);

  useMapEvents({
    mousedown(e: LeafletMouseEvent) {
      if (!isDrawMode) return;
      startRef.current = e.latlng;
      drawingRef.current = true;
      setBounds(null);
    },
    mousemove(e: LeafletMouseEvent) {
      if (!isDrawMode || !drawingRef.current || !startRef.current) return;
      const newBounds = L.latLngBounds(startRef.current, e.latlng);
      setBounds(newBounds);
    },
    mouseup(e: LeafletMouseEvent) {
      if (!isDrawMode || !drawingRef.current || !startRef.current) return;
      drawingRef.current = false;

      const dLat = Math.abs(e.latlng.lat - startRef.current.lat);
      const dLng = Math.abs(e.latlng.lng - startRef.current.lng);

      if (dLat < MIN_DRAG_DEG && dLng < MIN_DRAG_DEG) {
        // Too small — treat as a click, not a drag → ignore
        startRef.current = null;
        setBounds(null);
        return;
      }

      const finalBounds = L.latLngBounds(startRef.current, e.latlng);
      setBounds(finalBounds);
      startRef.current = null;
    },
  });

  if (!bounds) return null;

  return (
    <Rectangle
      bounds={bounds}
      pathOptions={{
        color: '#0d9488',
        weight: 2,
        fillColor: '#14b8a6',
        fillOpacity: 0.15,
        dashArray: '6 4',
      }}
    />
  );
}

/* ── Fit-to-bounds helper ── */
function FitBounds({ bbox }: { bbox: BBox | null }) {
  const map = useMap();
  useEffect(() => {
    if (bbox) {
      const b = L.latLngBounds(
        [bbox.south, bbox.west],
        [bbox.north, bbox.east]
      );
      map.fitBounds(b, { padding: [40, 40], maxZoom: 12 });
    }
  }, [bbox, map]);
  return null;
}

/* ── Main MapSelector Component ── */
export default function MapSelector({ onConfirm, onClose, initialBounds }: MapSelectorProps) {
  const [bounds, setBounds] = useState<LatLngBounds | null>(null);
  const [isDrawMode, setIsDrawMode] = useState(true);

  const handleConfirm = useCallback(() => {
    if (!bounds) return;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    onConfirm({
      south: sw.lat,
      north: ne.lat,
      west: sw.lng,
      east: ne.lng,
    });
  }, [bounds, onConfirm]);

  const handleReset = () => {
    setBounds(null);
    setIsDrawMode(true);
  };

  const sw = bounds?.getSouthWest();
  const ne = bounds?.getNorthEast();

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #0d9488, #14b8a6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MapPin size={16} color="#fff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Select Area on Map</h2>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                {isDrawMode ? '✏️ Draw mode — click and drag to draw a rectangle' : '🖐️ Pan mode — drag to navigate the map'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Draw / Pan toggle */}
            <button
              onClick={() => setIsDrawMode(!isDrawMode)}
              title={isDrawMode ? 'Switch to Pan mode' : 'Switch to Draw mode'}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0',
                background: isDrawMode ? 'linear-gradient(135deg, #0d9488, #14b8a6)' : '#f1f5f9',
                color: isDrawMode ? '#fff' : '#64748b',
                fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              {isDrawMode ? <Pencil size={13} /> : <Move size={13} />}
              <span>{isDrawMode ? 'Draw' : 'Pan'}</span>
            </button>
            <button onClick={onClose} style={closeButtonStyle} title="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Map */}
        <div style={{ flex: 1, position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          <MapContainer
            center={[26.8, 30.8]}
            zoom={5}
            style={{ width: '100%', height: '100%' }}
            dragging={!isDrawMode}
            scrollWheelZoom={true}
            doubleClickZoom={false}
            attributionControl={true}
          >
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution='&copy; <a href="https://www.esri.com/">Esri</a> — World Imagery'
            />
            <DrawRectangle bounds={bounds} setBounds={setBounds} isDrawMode={isDrawMode} />
            {initialBounds && !bounds && <FitBounds bbox={initialBounds} />}
          </MapContainer>

          {/* Coordinates Info Badge */}
          {bounds && sw && ne && (
            <div style={coordsBadgeStyle}>
              <span>N {ne.lat.toFixed(4)}°</span>
              <span>S {sw.lat.toFixed(4)}°</span>
              <span>E {ne.lng.toFixed(4)}°</span>
              <span>W {sw.lng.toFixed(4)}°</span>
            </div>
          )}

          {/* Hint badge when no rect */}
          {!bounds && isDrawMode && (
            <div style={{ ...coordsBadgeStyle, color: '#64748b', fontWeight: 500 }}>
              ✏️ Click and drag to draw a rectangle
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <button onClick={handleReset} style={resetButtonStyle} disabled={!bounds}>
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
          <button onClick={handleConfirm} style={{
            ...confirmButtonStyle,
            opacity: bounds ? 1 : 0.5,
            cursor: bounds ? 'pointer' : 'not-allowed',
          }} disabled={!bounds}>
            <Check size={14} />
            <span>Confirm Selection</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Styles ── */
const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9999,
  background: 'rgba(15, 23, 42, 0.6)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  animation: 'fadeIn 0.2s ease',
};

const modalStyle: React.CSSProperties = {
  width: '90vw',
  maxWidth: '900px',
  height: '80vh',
  maxHeight: '700px',
  background: '#ffffff',
  borderRadius: '16px',
  boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  padding: '16px',
  animation: 'slideUp 0.25s ease',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const closeButtonStyle: React.CSSProperties = {
  border: 'none',
  background: '#f1f5f9',
  borderRadius: '8px',
  padding: '6px',
  cursor: 'pointer',
  color: '#64748b',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s',
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
};

const resetButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 16px',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  background: '#fff',
  color: '#475569',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s',
};

const confirmButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 20px',
  border: 'none',
  borderRadius: '8px',
  background: 'linear-gradient(135deg, #0d9488, #14b8a6)',
  color: '#fff',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s',
};

const coordsBadgeStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '12px',
  left: '12px',
  zIndex: 1000,
  background: 'rgba(255,255,255,0.95)',
  backdropFilter: 'blur(8px)',
  borderRadius: '8px',
  padding: '6px 10px',
  display: 'flex',
  gap: '12px',
  fontSize: '11px',
  fontWeight: 600,
  color: '#0f172a',
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  border: '1px solid #e2e8f0',
};
