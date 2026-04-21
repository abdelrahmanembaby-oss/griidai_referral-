import { MapPanel } from './MapPanel';
import type { VectorLayer } from './MapPanel';

interface MapCurtainProps {
  isOpen: boolean;
  layers?: VectorLayer[];
}

export function MapCurtain({ isOpen, layers = [] }: MapCurtainProps) {
  return (
    <div className={`map-panel-wrapper ${isOpen ? 'map-panel-wrapper--open' : ''}`}>
      <div className="map-curtain-container">
        {/* The actual map */}
        <MapPanel isVisible={isOpen} layers={layers} />

        {/* Curtain overlay — slides up when open */}
        <div className={`map-curtain ${isOpen ? 'map-curtain--open' : ''}`}>
          <div className="map-curtain-label">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
              <line x1="9" y1="3" x2="9" y2="18" />
              <line x1="15" y1="6" x2="15" y2="21" />
            </svg>
            <span>Loading Map…</span>
          </div>
        </div>
      </div>
    </div>
  );
}
