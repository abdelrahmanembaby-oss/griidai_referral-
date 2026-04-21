import { AlertCircle, FileJson, Loader2 } from "lucide-react";

interface OsmStatusBarProps {
  error: string | null;
  isFetching: boolean;
  totalFeatures: number;
  layerCount: number;
}

export function OsmStatusBar({ error, isFetching, totalFeatures, layerCount }: OsmStatusBarProps) {
  return (
    <div className="h-10 shrink-0 border-t border-border bg-card shadow-sm px-4 flex items-center justify-between text-xs">
      <div className="flex items-center gap-4">
        {error ? (
          <div className="flex items-center gap-2 text-destructive font-medium">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>{error}</span>
          </div>
        ) : isFetching ? (
          <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span>Downloading objects from OSM...</span>
          </div>
        ) : (
          <div className="flex items-center gap-4 text-muted-foreground">
            <div className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
              API Connected
            </div>
            
            {layerCount > 0 && (
              <div className="flex items-center gap-1.5 border-l border-border pl-4">
                <FileJson className="h-3.5 w-3.5" />
                <span><strong className="text-foreground">{totalFeatures.toLocaleString()}</strong> features loaded</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 text-muted-foreground/80">
        <span className="flex items-center gap-1">
          Powered by <strong className="text-muted-foreground font-semibold">Overpass API</strong>
        </span>
        <span className="opacity-50">•</span>
        <span>GeoJSON Export</span>
      </div>
    </div>
  );
}
