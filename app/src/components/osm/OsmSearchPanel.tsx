import { useState, useRef } from "react";
import { Search, MapPin, Loader2, Globe, MountainSnow } from "lucide-react";
import type { OsmGeocodingResult } from "../../services/geocoding";
import type { BoundingBox } from "../../types/osm";

interface OsmSearchPanelProps {
  onGeocode: (query: string) => Promise<void>;
  onSelectLocation: (location: OsmGeocodingResult) => void;
  onFetchLayers: () => void;
  geocodingResults: OsmGeocodingResult[];
  isGeocoding: boolean;
  isFetching: boolean;
  bbox: BoundingBox | null;
}

export function OsmSearchPanel({
  onGeocode,
  onSelectLocation,
  onFetchLayers,
  geocodingResults,
  isGeocoding,
  isFetching,
  bbox
}: OsmSearchPanelProps) {
  const [query, setQuery] = useState("");
  const debounceRef = useRef<any>(null);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length >= 3) {
      debounceRef.current = setTimeout(() => onGeocode(val), 500);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          <Globe className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight">OSM Downloader</h2>
          <p className="text-xs text-muted-foreground">Download Vector Data</p>
        </div>
      </div>

      <div className="space-y-2 relative">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Search Region
        </label>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="City, neighborhood, address..."
            className="w-full h-9 pl-8 pr-8 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {isGeocoding && (
            <Loader2 className="absolute right-2.5 top-2.5 h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </div>

        {geocodingResults.length > 0 && Array.isArray(geocodingResults) && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-popover text-popover-foreground border border-border rounded-md shadow-md z-50 overflow-hidden">
            {geocodingResults.map((result) => (
              <button
                key={result.placeId}
                onClick={() => onSelectLocation(result)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-start gap-2 border-b border-border/50 last:border-0"
              >
                <MapPin className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                <span className="line-clamp-2">{result.displayName}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="pt-2">
        <button
          onClick={() => onFetchLayers()}
          disabled={!bbox || isFetching}
          className="w-full h-9 inline-flex items-center justify-center gap-2 rounded-md font-medium text-sm bg-primary text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors"
        >
          {isFetching ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Fetching Data...
            </>
          ) : (
            <>
              <MountainSnow className="h-3.5 w-3.5" />
              Load Vector Layers
            </>
          )}
        </button>
      </div>
    </div>
  );
}
