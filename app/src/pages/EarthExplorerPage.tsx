import { useState, useRef, useEffect } from 'react';
import { useImagerySearch } from '@/hooks/useImagerySearch';
import { downloadScene } from '@/services/usgs';
import {
  Search, MapPin, Calendar, Cloud, Satellite, Loader2,
  ChevronDown, X, AlertCircle, ImageIcon, Globe, Download,
} from 'lucide-react';
import type { GeocodingResult } from '@/types/imagery';

const DATASETS = [
  { value: 'landsat_ot_c2_l2', label: 'Landsat 8/9 OLI/TIRS c2 l2' },
  { value: 'landsat_ot_c2_l1', label: 'Landsat 8/9 OLI/TIRS c2 l1' },
  { value: 'landsat_etm_c2_l2', label: 'Landsat 7 ETM+ c2 l2' },
  { value: 'landsat_tm_c2_l2', label: 'Landsat 4-5 TM c2 l2' },
];

export function EarthExplorerPage() {
  const {
    geocodingResults, imageryResults, totalHits,
    isGeocoding, isSearching, isLoadingMore, error, selectedLocation,
    handleGeocode, handleSelectLocation, handleSearch, handleLoadMore,
  } = useImagerySearch();

  /* ── form state ── */
  const [locationQuery, setLocationQuery] = useState('');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-12-31');
  const [maxCloudCover, setMaxCloudCover] = useState(20);
  const [dataset, setDataset] = useState(DATASETS[0].value);
  const [hasSearched, setHasSearched] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced live geocoding
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (locationQuery.trim() && locationQuery !== selectedLocation?.displayName.split(',').slice(0, 2).join(',')) {
        handleGeocode(locationQuery);
        setShowDropdown(true);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [locationQuery, handleGeocode]);

  /* ── handlers ── */
  const onLocationKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && locationQuery.trim()) {
      setShowDropdown(true);
      await handleGeocode(locationQuery);
    }
  };

  const pickLocation = (loc: GeocodingResult) => {
    handleSelectLocation(loc);
    setLocationQuery(loc.displayName.split(',').slice(0, 2).join(','));
    setShowDropdown(false);
  };

  const onSearch = async () => {
    setHasSearched(true);
    await handleSearch({ startDate, endDate, maxCloudCover, dataset });
  };

  /* ── render ── */
  return (
    <div className="explorer-page">
      {/* ═══ Header ═══ */}
      <header className="explorer-header">
        <div className="explorer-header-left">
          <div className="explorer-header-icon">
            <Globe size={22} />
          </div>
          <div>
            <h1 className="explorer-title">Earth Explorer</h1>
            <p className="explorer-subtitle">USGS Satellite Imagery Search</p>
          </div>
        </div>
        {totalHits > 0 && (
          <span className="explorer-badge">Showing {imageryResults.length} of {totalHits} scenes</span>
        )}
      </header>

      {/* ═══ Filter Bar ═══ */}
      <div className="explorer-filters">
        {/* Location */}
        <div className="explorer-filter-group explorer-filter-group--location" ref={dropdownRef}>
          <label className="explorer-filter-label"><MapPin size={13} /> Location</label>
          <div className="explorer-input-wrap">
            <input
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              onKeyDown={onLocationKeyDown}
              placeholder="Search city or region…"
              className="explorer-input"
            />
            {isGeocoding && <Loader2 size={14} className="explorer-spin" />}
          </div>

          {showDropdown && geocodingResults.length > 0 && (
            <div className="explorer-dropdown">
              {geocodingResults.map((r, i) => (
                <button key={i} className="explorer-dropdown-item" onClick={() => pickLocation(r)}>
                  <MapPin size={13} />
                  <span>{r.displayName}</span>
                </button>
              ))}
            </div>
          )}

          {selectedLocation && (
            <div className="explorer-selected-pill">
              <MapPin size={11} />
              <span>{selectedLocation.displayName.split(',').slice(0, 2).join(',')}</span>
              <button onClick={() => { handleSelectLocation(null as any); setLocationQuery(''); }}>
                <X size={11} />
              </button>
            </div>
          )}
        </div>

        {/* Dates */}
        <div className="explorer-filter-group">
          <label className="explorer-filter-label"><Calendar size={13} /> Start Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="explorer-input" />
        </div>
        <div className="explorer-filter-group">
          <label className="explorer-filter-label"><Calendar size={13} /> End Date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="explorer-input" />
        </div>

        {/* Cloud Cover */}
        <div className="explorer-filter-group">
          <label className="explorer-filter-label"><Cloud size={13} /> Cloud ≤ {maxCloudCover}%</label>
          <input
            type="range" min={0} max={100} value={maxCloudCover}
            onChange={(e) => setMaxCloudCover(Number(e.target.value))}
            className="explorer-slider"
          />
        </div>

        {/* Dataset */}
        <div className="explorer-filter-group">
          <label className="explorer-filter-label"><Satellite size={13} /> Dataset</label>
          <div className="explorer-select-wrap">
            <select value={dataset} onChange={(e) => setDataset(e.target.value)} className="explorer-select">
              {DATASETS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
            <ChevronDown size={13} className="explorer-select-chevron" />
          </div>
        </div>

        {/* Search button */}
        <button className="explorer-search-btn" onClick={onSearch} disabled={isSearching || !selectedLocation}>
          {isSearching ? <Loader2 size={16} className="explorer-spin" /> : <Search size={16} />}
          <span>{isSearching ? 'Searching…' : 'Search'}</span>
        </button>
      </div>

      {/* ═══ Error ═══ */}
      {error && (
        <div className="explorer-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* ═══ Results Grid ═══ */}
      <div className="explorer-results">
        {!hasSearched && imageryResults.length === 0 && (
          <div className="explorer-empty">
            <Globe size={48} strokeWidth={1.2} />
            <h2>Search for Satellite Imagery</h2>
            <p>Enter a location, set your filters, and hit search to browse USGS scenes.</p>
          </div>
        )}

        {hasSearched && !isSearching && imageryResults.length === 0 && !error && (
          <div className="explorer-empty">
            <ImageIcon size={48} strokeWidth={1.2} />
            <h2>No Results Found</h2>
            <p>Try adjusting your filters or choosing a different location.</p>
          </div>
        )}

        {isSearching && (
          <div className="explorer-empty">
            <Loader2 size={48} className="explorer-spin" strokeWidth={1.5} />
            <h2>Searching USGS…</h2>
            <p>This may take a few seconds.</p>
          </div>
        )}

        {imageryResults.length > 0 && (
          <div className="explorer-grid">
            {imageryResults.map((img) => (
              <div key={img.entityId} className="explorer-card">
                <div className="explorer-card-img">
                  {img.browseUrl ? (
                    <img src={img.browseUrl} alt={img.displayId} loading="lazy" />
                  ) : (
                    <div className="explorer-card-noimg"><ImageIcon size={28} /></div>
                  )}
                  <span className="explorer-card-cloud">
                    <Cloud size={11} /> {img.cloudCover.toFixed(1)}%
                  </span>
                </div>
                <div className="explorer-card-body">
                  <p className="explorer-card-id">{img.displayId}</p>
                  <div className="explorer-card-meta">
                    <span><Calendar size={11} /> {img.acquisitionDate}</span>
                    <span><Satellite size={11} /> {img.sensor}</span>
                  </div>
                  <div className="explorer-card-bounds">
                    N {img.spatialBounds.north.toFixed(2)}°,
                    S {img.spatialBounds.south.toFixed(2)}°,
                    E {img.spatialBounds.east.toFixed(2)}°,
                    W {img.spatialBounds.west.toFixed(2)}°
                  </div>
                  <button
                    className="explorer-download-btn"
                    disabled={downloadingId === img.entityId}
                    onClick={async () => {
                      setDownloadingId(img.entityId);
                      setDownloadError(null);
                      try {
                        const result = await downloadScene(img.entityId, img.dataset);
                        if (result.error) {
                          setDownloadError(result.error);
                        } else if (result.downloads.length > 0) {
                          // Bypass popup blockers by creating an anchor element
                          result.downloads.forEach((dl) => {
                            const a = document.createElement('a');
                            a.href = dl.url;
                            a.target = '_blank';
                            // Optional: set download attribute to force download instead of open
                            a.download = dl.productName || 'download';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                          });
                        }
                      } catch (e: any) {
                        setDownloadError(e.message);
                      } finally {
                        setDownloadingId(null);
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      width: '100%', marginTop: '8px', padding: '8px 12px',
                      border: 'none', borderRadius: '8px', cursor: 'pointer',
                      background: 'linear-gradient(135deg, #0d9488, #14b8a6)',
                      color: '#fff', fontSize: '12px', fontWeight: 600,
                      transition: 'all 0.2s',
                    }}
                  >
                    {downloadingId === img.entityId
                      ? <Loader2 size={14} className="explorer-spin" />
                      : <Download size={14} />
                    }
                    <span>{downloadingId === img.entityId ? 'Fetching links…' : 'Download Bands'}</span>
                  </button>
                  {downloadError && downloadingId === null && (
                    <p style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>{downloadError}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {hasSearched && imageryResults.length > 0 && imageryResults.length < totalHits && (
          <div className="explorer-load-more" style={{ display: 'flex', justifyContent: 'center', padding: '24px 0 48px' }}>
            <button 
              onClick={handleLoadMore} 
              disabled={isLoadingMore}
              className="explorer-search-btn"
              style={{ padding: '10px 24px', borderRadius: '999px' }}
            >
              {isLoadingMore ? <Loader2 size={16} className="explorer-spin" /> : <ChevronDown size={16} />}
              <span>{isLoadingMore ? 'Loading More…' : `Load More (${totalHits - imageryResults.length} remaining)`}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
