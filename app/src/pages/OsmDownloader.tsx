import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Map as MapIcon, AlertTriangle, HelpCircle } from "lucide-react";

import { useOsmDownloader } from "../hooks/useOsmDownloader";
import { OsmSearchPanel } from "../components/osm/OsmSearchPanel";
import { OsmLayerList } from "../components/osm/OsmLayerList";
import { OsmStatusBar } from "../components/osm/OsmStatusBar";
import { OsmMap } from "../components/osm/OsmMap";
import { GcsBucketSidebar } from "../components/GcsBucketSidebar";

export default function OsmDownloader() {
  const osm = useOsmDownloader();
  const [mapMode, setMapMode] = useState<"pan" | "select" | "clip">("pan");
  const [gcsSidebarOpen, setGcsSidebarOpen] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    const handleBucketChanged = () => {
      setGcsSidebarOpen(true);
    };
    window.addEventListener('gcs-bucket-changed', handleBucketChanged);
    return () => window.removeEventListener('gcs-bucket-changed', handleBucketChanged as any);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* HEADER */}
      <header className="h-14 shrink-0 border-b border-border bg-card flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-1.5 -ml-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to Dashboard</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
              <MapIcon className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight">GriidAi Web App</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none">OSM Vector Explorer</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-md border border-border">
            <button
              onClick={() => {
                setMapMode("pan");
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all shadow-sm ${
                mapMode === "pan"
                  ? "bg-background text-foreground ring-1 ring-border"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              }`}
            >
              🖐️ Pan
            </button>
            <button
              onClick={() => {
                setMapMode("select");
                osm.handleClipBbox(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all shadow-sm ${
                mapMode === "select"
                  ? "bg-background text-foreground ring-1 ring-border"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              }`}
            >
              Select Base Area
            </button>
            <button
              onClick={() => setMapMode("clip")}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all shadow-sm ${
                mapMode === "clip"
                  ? "bg-background text-foreground ring-1 ring-border"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              }`}
            >
              Clip (Sub-Region)
            </button>
          </div>
          
          <button 
            onClick={() => setShowInstructions(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mr-2"
          >
            <HelpCircle className="h-5 w-5" />
            Instructions
          </button>
        </div>
      </header>

      {/* BODY */}
      <div className="flex flex-1 min-h-0 relative">
        {/* LEFT PANEL */}
        <aside className="w-80 shrink-0 border-r border-border bg-card/60 backdrop-blur-sm flex flex-col z-10 shadow-xl">
          <div className="p-4 border-b border-border min-h-[40%] flex-shrink-0">
            <OsmSearchPanel
              onGeocode={osm.handleGeocode}
              onSelectLocation={osm.handleSelectLocation}
              onFetchLayers={osm.handleFetchLayers}
              geocodingResults={osm.geocodingResults}
              isGeocoding={osm.isGeocoding}
              isFetching={osm.isFetching}
              bbox={osm.bbox}
            />
          </div>

          <div className="flex-1 p-4 min-h-0 overflow-hidden isolate relative">
            <OsmLayerList
              layers={osm.allLayers.map(l => {
                const fetched = osm.layers.find(val => val.id === l.id);
                return { ...l, data: fetched?.data }; // Provide data count info if needed
              })}
              onToggleVisibility={osm.toggleLayerVisibility}
              onToggleSelection={osm.toggleLayerSelection}
              onDownloadLayer={osm.downloadLayer}
              onDownloadAll={osm.downloadAllSelected}
              onExportLayer={osm.exportLayerToGcs}
              exportStates={osm.exportStates}
              clipActive={osm.clipBbox !== null}
            />
          </div>
        </aside>

        {/* MAP AREA */}
        <main className="flex-1 relative z-0">
          <OsmMap
            bbox={osm.bbox}
            clipBbox={osm.clipBbox}
            layers={osm.layers}
            onDrawBbox={(b) => { osm.handleDrawBbox(b); setMapMode("pan"); }}
            onClipBbox={(b) => { osm.handleClipBbox(b); /* remain in clip mode for confirmation */ }}
            mode={mapMode}
          />

          {osm.isFetching && (
            <div className="absolute inset-0 z-[1000] bg-background/50 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-300">
              <div className="bg-card border border-border rounded-xl px-8 py-6 flex flex-col items-center gap-4 shadow-2xl">
                <div className="relative">
                  <div className="h-12 w-12 border-4 border-primary/20 rounded-full" />
                  <div className="absolute top-0 left-0 h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-base font-semibold text-foreground">Fetching Sub-Objects...</p>
                  <p className="text-sm text-muted-foreground mt-1">Connecting to Overpass API</p>
                </div>
              </div>
            </div>
          )}

          {/* Confirm/Cancel Clip Overlay */}
          {mapMode === "clip" && osm.clipBbox && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[2000] bg-card/95 backdrop-blur-md px-4 py-3 rounded-xl shadow-2xl border border-border flex items-center gap-4 animate-in slide-in-from-top-4">
              <span className="text-sm font-semibold whitespace-nowrap">Apply this clip natively?</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    osm.applyClip();
                    setMapMode("pan");
                  }}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-sm font-bold shadow-sm transition-colors"
                >
                  Confirm ✓
                </button>
                <button 
                  onClick={() => {
                    osm.cancelClip();
                    setMapMode("pan");
                  }}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-destructive/90 hover:bg-destructive text-white rounded-md text-sm font-bold shadow-sm transition-colors"
                >
                  Cancel ✕
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* FOOTER */}
      <OsmStatusBar
        error={null} // We handle error in the popup now
        isFetching={osm.isFetching}
        totalFeatures={osm.totalFeatures}
        layerCount={osm.layers.length}
      />

      {/* ERROR POPUP MODAL */}
      {osm.error && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-md mx-4 rounded-xl shadow-2xl border border-destructive/20 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="bg-destructive/10 p-4 flex items-start gap-3">
              <div className="bg-destructive/20 p-2 rounded-full mt-0.5">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-destructive mb-1.5">Notice</h3>
                <p className="text-sm text-foreground/90 leading-relaxed selection:bg-destructive/20">
                  {osm.error}
                </p>
              </div>
            </div>
            <div className="p-4 bg-muted/30 border-t border-border flex justify-end">
              <button
                onClick={osm.clearError}
                className="px-6 py-2 bg-primary text-primary-foreground font-semibold rounded-md shadow-sm hover:bg-primary/90 transition-colors focus:ring-2 focus:ring-primary/20 outline-none"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INSTRUCTIONS MODAL */}
      {showInstructions && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-2xl mx-4 rounded-xl shadow-2xl border border-border overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border bg-muted/30">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <HelpCircle className="h-6 w-6 text-primary" />
                How to Use OSM Explorer
              </h2>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <span className="flex items-center justify-center bg-primary text-primary-foreground rounded-full w-6 h-6 text-sm">1</span> 
                  Select a Location
                </h3>
                <p className="text-muted-foreground leading-relaxed pl-8">
                  Use the left panel to search for a city or region. You can also use the <strong>"Select Base Area"</strong> tool from the top toolbar to draw a specific square on the map to define your search bounds.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <span className="flex items-center justify-center bg-primary text-primary-foreground rounded-full w-6 h-6 text-sm">2</span> 
                  Fetch Layers
                </h3>
                <p className="text-muted-foreground leading-relaxed pl-8">
                  Choose the map layers you want to download (e.g., Buildings, Roads, Green Areas) by toggling the switch next to them, then click <strong>"Fetch Data"</strong>. The system will retrieve the vector data from OpenStreetMap.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <span className="flex items-center justify-center bg-primary text-primary-foreground rounded-full w-6 h-6 text-sm">3</span> 
                  Clip specific Sub-Region (Optional)
                </h3>
                <p className="text-muted-foreground leading-relaxed pl-8">
                  If you only need a small portion of the fetched area, click the <strong>"Clip (Sub-Region)"</strong> button in the top toolbar to draw a smaller box. Then click <strong>Confirm ✓</strong> to crop all data strictly to your drawn area.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <span className="flex items-center justify-center bg-primary text-primary-foreground rounded-full w-6 h-6 text-sm">4</span> 
                  Export or Download
                </h3>
                <p className="text-muted-foreground leading-relaxed pl-8">
                  Under each fetched layer, you can click the download icon to save it locally as GeoJSON, or click <strong>Use in GriidAi</strong> to automatically send it to your storage bucket.
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-border bg-muted/30 flex justify-end">
              <button
                onClick={() => setShowInstructions(false)}
                className="px-6 py-2 bg-primary text-primary-foreground font-semibold rounded-md shadow-sm hover:bg-primary/90 transition-colors focus:ring-2 focus:ring-primary/20 outline-none"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GCS SIDEBAR */}
      <GcsBucketSidebar open={gcsSidebarOpen} onClose={() => setGcsSidebarOpen(false)} />
    </div>
  );
}
