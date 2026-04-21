import { useState, useCallback } from "react";
import type { BoundingBox, OsmLayer } from "../types/osm";
import { DEFAULT_OSM_LAYERS } from "../types/osm";
import { osmGeocodeRegion, type OsmGeocodingResult } from "../services/geocoding";
import { fetchOsmData } from "../services/overpass";
import bboxClip from "@turf/bbox-clip";
import { featureCollection } from "@turf/helpers";

export function useOsmDownloader() {
  const [layers, setLayers] = useState<OsmLayer[]>([]);
  const [bbox, setBbox] = useState<BoundingBox | null>(null);
  const [clipBbox, setClipBbox] = useState<BoundingBox | null>(null);
  
  const [isFetching, setIsFetching] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [geocodingResults, setGeocodingResults] = useState<OsmGeocodingResult[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<OsmGeocodingResult | null>(null);

  const [geojsonData, setGeojsonData] = useState<Record<string, GeoJSON.FeatureCollection>>({});
  const [exportStates, setExportStates] = useState<Record<string, { status: 'idle' | 'processing' | 'success' | 'error', message?: string }>>({});
  
  // Total features across all active layers
  const totalFeatures = Object.values(geojsonData).reduce(
    (acc, collection) => acc + collection.features.length, 
    0
  );

  const handleGeocode = async (query: string) => {
    if (!query) {
      setGeocodingResults([]);
      return;
    }
    
    setIsGeocoding(true);
    setError(null);
    try {
      const results = await osmGeocodeRegion(query);
      setGeocodingResults(results);
    } catch (err: any) {
      setError("Failed to find location. Please try another search term.");
      setGeocodingResults([]);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSelectLocation = (location: OsmGeocodingResult) => {
    setSelectedLocation(location);
    setBbox({
      south: location.boundingBox[0],
      north: location.boundingBox[1],
      west: location.boundingBox[2],
      east: location.boundingBox[3],
    });
    setClipBbox(null);
    setGeocodingResults([]);
    
    // Clear previous map data to prepare for new query
    setGeojsonData({});
    setLayers(DEFAULT_OSM_LAYERS.map(l => ({ ...l, selected: false })));
  };

  const handleDrawBbox = (newBbox: BoundingBox) => {
    setBbox(newBbox);
    setClipBbox(null);
    setSelectedLocation(null); // Custom drawn area isn't a specific named location
    setGeojsonData({});
    setLayers(DEFAULT_OSM_LAYERS.map(l => ({ ...l, selected: false })));
  };

  const handleClipBbox = (newClipBbox: BoundingBox | null) => {
    setClipBbox(newClipBbox);
  };

  const handleFetchLayers = async () => {
    if (!bbox) {
      setError("Please select a region first.");
      return;
    }

    // Rough check for bounding box size to prevent massive queries - REMOVED based on user request
    // No minimum or maximum area limits applied.

    setIsFetching(true);
    setError(null);
    setGeojsonData({}); // Clear previous data
    
    try {
      const currentLayers = layers.length > 0 ? layers : DEFAULT_OSM_LAYERS;
      const activeLayers = currentLayers.filter(layer => layer.selected);
      
      if (activeLayers.length === 0) {
        setError("No layers selected. Please choose 1-2 layers before loading.");
        setIsFetching(false);
        return;
      }

      // Make the selected layers visible and hide the unselected ones
      setLayers(currentLayers.map(l => ({ ...l, visible: l.selected })));
      
      const newGeojsonData: Record<string, GeoJSON.FeatureCollection> = {};
      
      // Fetch layers sequentially to avoid hammering the Overpass API
      for (const layer of activeLayers) {
        try {
          // Small delay before each request (except maybe first, but easier to just delay all) to prevent 429 Too Many Requests
          if (Object.keys(newGeojsonData).length > 0) {
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
          const data = await fetchOsmData(bbox, layer);
          if (data && data.features && data.features.length > 0) {
            newGeojsonData[layer.id] = data;
          }
        } catch (layerErr) {
          console.warn(`Failed to fetch layer ${layer.name}:`, layerErr);
          // Continue fetching other layers despite failure
        }
      }
      
      setGeojsonData(newGeojsonData);
      
      if (Object.keys(newGeojsonData).length === 0) {
        setError("An error occurred while retrieving the data. This may be because the selected area is too large, so please try a smaller area, or because no data is available for this region. If the issue continues after reducing the area, it likely means no data is available.");
      }
    } catch (err: any) {
      setError("An error occurred while retrieving the data. This may be because the selected area is too large, so please try a smaller area, or because no data is available for this region. If the issue continues after reducing the area, it likely means no data is available.");
    } finally {
      setIsFetching(false);
    }
  };

  const toggleLayerVisibility = (layerId: string) => {
    setLayers(prev => prev.map(l => 
      l.id === layerId ? { ...l, visible: !l.visible } : l
    ));
    
    // Check if we need to remove the data from state
    const layer = layers.find(l => l.id === layerId);
    if (layer && layer.visible && geojsonData[layerId]) {
       // Optional: We can keep it in memory but not render it, which is achieved in the component layer mapping.
    } else if (layer && !layer.visible && bbox) {
       // If turning on a layer that wasn't fetched, we'd need to fetch it.
       // For simplicity in this demo, they need to click "Fetch Data" again if they toggle new layers on.
    }
  };

  const toggleLayerSelection = (layerId: string) => {
    setLayers(prev => prev.map(l => 
      l.id === layerId ? { ...l, selected: !l.selected } : l
    ));
  };
  
  // Helper to clip features if a clipBbox is defined
  const getDownloadableData = useCallback((layerId: string): GeoJSON.FeatureCollection | null => {
    const data = geojsonData[layerId];
    if (!data) return null;

    if (!clipBbox) return data;

    // Apply Turf clipping
    const clippedFeatures: any[] = [];
    
    for (const feature of data.features) {
      try {
        if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
          const clipped = bboxClip(feature as any, [clipBbox.west, clipBbox.south, clipBbox.east, clipBbox.north]);
          // bboxClip might return a feature with empty geometry if completely outside
          if (clipped.geometry && clipped.geometry.coordinates.length > 0) {
             clipped.properties = feature.properties;
             clippedFeatures.push(clipped);
          }
        } else {
          // Points and LineStrings: For simplicity, keep if point is inside bbox
          // Real-world would use booleanPointInPolygon or line clipping
          // Here we just keep them if they are in the dataset
          clippedFeatures.push(feature);
        }
      } catch (e) {
        // Fallback for weird geometries
        clippedFeatures.push(feature);
      }
    }

    return featureCollection(clippedFeatures);
  }, [geojsonData, clipBbox]);

  const applyClip = useCallback(() => {
    if (!clipBbox) return;
    const newGeojsonData: Record<string, GeoJSON.FeatureCollection> = {};
    for (const layerId of Object.keys(geojsonData)) {
      const clipped = getDownloadableData(layerId);
      if (clipped) {
        newGeojsonData[layerId] = clipped;
      }
    }
    setGeojsonData(newGeojsonData);
    setClipBbox(null);
  }, [clipBbox, geojsonData, getDownloadableData]);

  const cancelClip = useCallback(() => {
    setClipBbox(null);
  }, []);

  const downloadLayer = (layerId: string) => {
    const dataToDownload = getDownloadableData(layerId);
    if (!dataToDownload || dataToDownload.features.length === 0) return;

    const layer = layers.find(l => l.id === layerId);
    const filename = `${layer?.name.toLowerCase().replace(/\s+/g, '_')}_${new Date().getTime()}.geojson`;
    
    const blob = new Blob([JSON.stringify(dataToDownload, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAllSelected = () => {
    const selectedLayers = layers.filter(l => l.selected);
    if (selectedLayers.length === 0) return;

    // Combine all selected layers into one FeatureCollection
    const allFeatures: any[] = [];
    selectedLayers.forEach(layer => {
      const data = getDownloadableData(layer.id);
      if (data) {
        allFeatures.push(...data.features);
      }
    });

    if (allFeatures.length === 0) return;

    const combinedCollection = featureCollection(allFeatures);
    const filename = `osm_vector_export_${new Date().getTime()}.geojson`;
    
    const blob = new Blob([JSON.stringify(combinedCollection, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportLayerToGcs = async (layerId: string) => {
    const dataToDownload = getDownloadableData(layerId);
    if (!dataToDownload || dataToDownload.features.length === 0) return;

    const layer = layers.find(l => l.id === layerId);
    const filename = `${layer?.name.toLowerCase().replace(/\s+/g, '_')}_${new Date().getTime()}.geojson`;
    
    const blob = new Blob([JSON.stringify(dataToDownload)], { type: 'application/geo+json' });
    const file = new File([blob], filename, { type: 'application/geo+json' });

    setExportStates(prev => ({ ...prev, [layerId]: { status: 'processing', message: 'Saving to GCS...' } }));

    try {
      const { uploadRawOsm, submitBatchExport, getBatchExportStatus } = await import('../api/gcsApi');
      
      setExportStates(prev => ({ ...prev, [layerId]: { status: 'processing', message: 'Uploading raw data...' } }));
      const uploadRes = await uploadRawOsm(file);
      
      if (!uploadRes.success || !uploadRes.gcs_uri) throw new Error("Upload failed");

      setExportStates(prev => ({ ...prev, [layerId]: { status: 'processing', message: 'Submitting batch job...' } }));
      const jobRes = await submitBatchExport(uploadRes.gcs_uri, 'geoparquet');
      
      setExportStates(prev => ({ ...prev, [layerId]: { status: 'processing', message: 'Processing in cloud...' } }));
      
      // Notify sidebar so it opens while we're processing
      window.dispatchEvent(new CustomEvent('gcs-bucket-changed'));

      // Poll until processing is complete
      let isDone = false;
      while (!isDone) {
        await new Promise(resolve => setTimeout(resolve, 8000)); // wait 8s between checks
        const statusRes = await getBatchExportStatus(jobRes.job_id);
        
        if (statusRes.status === 'SUCCEEDED') {
          isDone = true;
          setExportStates(prev => ({ ...prev, [layerId]: { status: 'success', message: 'Exported!' } }));
          window.dispatchEvent(new CustomEvent('gcs-bucket-changed'));
          
          setTimeout(() => {
            setExportStates(prev => ({ ...prev, [layerId]: { status: 'idle' } }));
          }, 5000);
        } else if (statusRes.status === 'FAILED') {
          isDone = true;
          throw new Error(statusRes.message || "Cloud job failed");
        } else {
           // still processing
          setExportStates(prev => ({ ...prev, [layerId]: { status: 'processing', message: `Cloud: ${statusRes.status}` } }));
        }
      }
    } catch (err: any) {
      console.error(err);
      setExportStates(prev => ({ ...prev, [layerId]: { status: 'error', message: err.message || 'Failed' } }));
      setTimeout(() => {
        setExportStates(prev => ({ ...prev, [layerId]: { status: 'idle' } }));
      }, 5000);
    }
  };

  // Prepare layers map for rendering
  const activeGeoJsonLayers = layers
    .filter(l => l.visible && geojsonData[l.id])
    .map(l => ({
      ...l,
      data: geojsonData[l.id]
    }));

  return {
    layers: activeGeoJsonLayers,
    allLayers: layers,
    bbox,
    clipBbox,
    isFetching,
    isGeocoding,
    error,
    geocodingResults,
    selectedLocation,
    totalFeatures,
    handleGeocode,
    handleSelectLocation,
    handleDrawBbox,
    handleClipBbox,
    applyClip,
    cancelClip,
    handleFetchLayers,
    toggleLayerVisibility,
    toggleLayerSelection,
    downloadLayer,
    downloadAllSelected,
    exportLayerToGcs,
    exportStates,
    clearError: () => setError(null)
  };
}
