import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';

export interface VectorLayer {
  id: string; // job_id
  name: string;
  url: string; // pmtiles signed url
}

interface MapPanelProps {
  /** When true the map is visible – we call map.resize() so tiles fill the container */
  isVisible: boolean;
  layers?: VectorLayer[];
}

export function MapPanel({ isVisible, layers = [] }: MapPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  /* ── Add PMTiles protocol globally ── */
  useEffect(() => {
    let protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);
    return () => {
      maplibregl.removeProtocol('pmtiles');
    };
  }, []);

  /* ── Create / destroy the MapLibre instance ── */
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          },
        },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [31.2357, 30.0444], // Cairo, Egypt
      zoom: 5,
    });

    // Add navigation controls (zoom +/‑ & compass)
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
        // Just a flag to say we are loaded if needed
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  /* ── Manage Vector Layers ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // This simplistic approach assumes layers are added when map is ready. 
    // Wait for style load to be safe.
    const addLayers = () => {
        // Remove layers and sources that are not in the new layers list
        const currentLayerIds = layers.map(l => l.id);
        
        map.getStyle().layers?.forEach(layer => {
           if (layer.id.endsWith('-fill') || layer.id.endsWith('-line')) {
               const baseId = (layer as any).source as string;
               if (baseId !== 'osm' && !currentLayerIds.includes(baseId)) {
                   if (map.getLayer(layer.id)) map.removeLayer(layer.id);
               }
           }
        });

        // remove unused sources
        const allSources = map.getStyle().sources;
        if (allSources) {
            Object.keys(allSources).forEach(sourceId => {
                if (sourceId !== 'osm' && !currentLayerIds.includes(sourceId)) {
                    if (map.getSource(sourceId)) map.removeSource(sourceId);
                }
            });
        }

        // Add new layers
        layers.forEach(layer => {
            if (!map.getSource(layer.id)) {
                map.addSource(layer.id, {
                    type: 'vector',
                    url: `pmtiles://${layer.url}`
                });

                map.addLayer({
                    id: `${layer.id}-fill`,
                    type: 'fill',
                    source: layer.id,
                    'source-layer': 'layer', // default from tippecanoe command in backend
                    paint: {
                        'fill-color': '#2b8a8a',
                        'fill-opacity': 0.4
                    }
                });

                map.addLayer({
                    id: `${layer.id}-line`,
                    type: 'line',
                    source: layer.id,
                    'source-layer': 'layer',
                    paint: {
                        'line-color': '#1a6b6b',
                        'line-width': 1.5
                    }
                });
                
                // Ensure it fits to screen roughly (optional, typically you'd need the bounds of the PMTiles)
            }
        });
    };

    if (map.isStyleLoaded()) {
        addLayers();
    } else {
        map.once('styledata', addLayers);
    }

  }, [layers]);


  /* ── Resize when the panel opens so tiles fill the space ── */
  useEffect(() => {
    if (isVisible && mapRef.current) {
      // Small delay to let the CSS transition expose the container size
      const id = setTimeout(() => mapRef.current?.resize(), 350);
      return () => clearTimeout(id);
    }
  }, [isVisible]);

  return <div ref={containerRef} className="map-container" id="map-panel" />;
}
