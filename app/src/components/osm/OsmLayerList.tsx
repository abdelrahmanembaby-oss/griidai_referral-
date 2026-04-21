import { Eye, EyeOff, Download, CheckSquare, Square, Layers, DownloadCloud, CloudUpload, Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { OsmLayer } from "../../types/osm";

interface ExportState {
  status: 'idle' | 'processing' | 'success' | 'error';
  message?: string;
}

interface OsmLayerListProps {
  layers: OsmLayer[];
  onToggleVisibility: (id: string) => void;
  onToggleSelection: (id: string) => void;
  onDownloadLayer: (id: string) => void;
  onDownloadAll: () => void;
  onExportLayer?: (id: string) => void;
  exportStates?: Record<string, ExportState>;
  clipActive: boolean;
}

export function OsmLayerList({
  layers,
  onToggleVisibility,
  onToggleSelection,
  onDownloadLayer,
  onDownloadAll,
  onExportLayer,
  exportStates = {},
  clipActive,
}: OsmLayerListProps) {
  const selectedCount = layers.filter((l) => l.selected).length;

  const getExportIcon = (layerId: string) => {
    const state = exportStates[layerId];
    if (!state || state.status === 'idle') {
      return <CloudUpload className="h-3.5 w-3.5" />;
    }
    if (state.status === 'processing') {
      return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    }
    if (state.status === 'success') {
      return <CheckCircle2 className="h-3.5 w-3.5" />;
    }
    if (state.status === 'error') {
      return <XCircle className="h-3.5 w-3.5" />;
    }
    return <CloudUpload className="h-3.5 w-3.5" />;
  };

  const getExportButtonClass = (layerId: string) => {
    const state = exportStates[layerId];
    if (!state || state.status === 'idle') {
      return "text-muted-foreground hover:bg-primary/10 hover:text-primary";
    }
    if (state.status === 'processing') {
      return "text-amber-500 cursor-wait";
    }
    if (state.status === 'success') {
      return "text-emerald-500";
    }
    if (state.status === 'error') {
      return "text-destructive";
    }
    return "text-muted-foreground hover:bg-primary/10 hover:text-primary";
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-md border border-border shadow-sm">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Layers className="h-4 w-4 text-primary" />
          Available Layers
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {layers.map((layer) => {
          const exportState = exportStates[layer.id];
          const isExporting = exportState?.status === 'processing';

          return (
            <div
              key={layer.id}
              className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 transition-colors group"
            >
              {/* Selection Checkbox */}
              <button
                onClick={() => onToggleSelection(layer.id)}
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                {layer.selected ? (
                  <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
              </button>

              {/* Color Indicator */}
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: layer.color }}
              />

              {/* Name */}
              <span className="text-sm font-medium flex-1 truncate">{layer.name}</span>

              {/* Visibility Toggle */}
              <button
                onClick={() => onToggleVisibility(layer.id)}
                className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                  layer.visible ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {layer.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>

              {/* Download per layer */}
              <button
                onClick={() => onDownloadLayer(layer.id)}
                className="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                title={clipActive ? "Download Clipped Data" : "Download Data"}
              >
                <Download className="h-3.5 w-3.5" />
              </button>

              {/* Export to GriidAi */}
              {onExportLayer && (
                <button
                  onClick={() => !isExporting && onExportLayer(layer.id)}
                  disabled={isExporting}
                  className={`p-1 rounded transition-all ${
                    isExporting ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  } ${getExportButtonClass(layer.id)}`}
                  title={
                    exportState?.status === 'processing'
                      ? exportState.message || 'Processing...'
                      : exportState?.status === 'success'
                      ? 'Exported to GriidAi!'
                      : exportState?.status === 'error'
                      ? exportState.message || 'Export failed'
                      : 'Use in GriidAi'
                  }
                >
                  {getExportIcon(layer.id)}
                </button>
              )}
            </div>
          );
        })}
        {layers.length === 0 && (
          <div className="text-center py-6 text-sm text-muted-foreground">
            Search for a location and load layers to see them here.
          </div>
        )}
      </div>

      {layers.length > 0 && (
        <div className="p-3 border-t border-border bg-muted/20 space-y-2">
          <button
            onClick={onDownloadAll}
            disabled={selectedCount === 0}
            className="w-full h-8 inline-flex items-center justify-center gap-2 rounded text-xs font-medium bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 disabled:opacity-50 transition-colors"
          >
            <DownloadCloud className="h-3.5 w-3.5" />
            Download Selected ({selectedCount}) 
            {clipActive && " (Clipped)"}
          </button>

          {onExportLayer && (
            <button
              onClick={() => {
                const selectedLayers = layers.filter(l => l.selected);
                selectedLayers.forEach(l => onExportLayer(l.id));
              }}
              disabled={selectedCount === 0}
              className="w-full h-8 inline-flex items-center justify-center gap-2 rounded text-xs font-medium bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <CloudUpload className="h-3.5 w-3.5" />
              Use in GriidAi ({selectedCount})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
