import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { useImagerySearch } from '@/hooks/useImagerySearch';
import { downloadScene, fetchCopernicusBands, type CopernicusBandInfo } from '@/services/usgs';
import {
  Search, MapPin, Calendar, Cloud, Satellite, Loader2,
  ChevronDown, X, AlertCircle, ImageIcon, Globe, Download, Map as MapIcon,
} from 'lucide-react';
import type { GeocodingResult } from '@/types/imagery';
import type { BBox } from '@/components/MapSelector';

const MapSelector = lazy(() => import('@/components/MapSelector'));

/* ── Provider + Dataset config ── */
type Provider = 'usgs' | 'copernicus';

const SATELLITE_OPTIONS = [
  // Copernicus - Sentinel
  { value: 'SENTINEL-2', label: 'Copernicus Sentinel-2 (MSI)', provider: 'copernicus' as Provider },
  { value: 'SENTINEL-1', label: 'Copernicus Sentinel-1 (SAR)', provider: 'copernicus' as Provider },
  { value: 'SENTINEL-3', label: 'Copernicus Sentinel-3 (OLCI/SLSTR)', provider: 'copernicus' as Provider },
  { value: 'SENTINEL-5P', label: 'Copernicus Sentinel-5P (TROPOMI)', provider: 'copernicus' as Provider },

  // Copernicus - Landsat
  { value: 'LANDSAT-8', label: 'Copernicus Landsat 8 (OLI/TIRS)', provider: 'copernicus' as Provider },
  { value: 'LANDSAT-9', label: 'Copernicus Landsat 9 (OLI-2/TIRS-2)', provider: 'copernicus' as Provider },

  // USGS / Landsat (direct)
  { value: 'landsat_ot_c2_l2', label: 'USGS Landsat 8/9 OLI/TIRS c2 l2', provider: 'usgs' as Provider },
  { value: 'landsat_ot_c2_l1', label: 'USGS Landsat 8/9 OLI/TIRS c2 l1', provider: 'usgs' as Provider },
  { value: 'landsat_etm_c2_l2', label: 'USGS Landsat 7 ETM+ c2 l2', provider: 'usgs' as Provider },
  { value: 'landsat_tm_c2_l2', label: 'USGS Landsat 4-5 TM c2 l2', provider: 'usgs' as Provider },
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
  const [selectedSatellite, setSelectedSatellite] = useState(SATELLITE_OPTIONS[0].value);
  const [hasSearched, setHasSearched] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Copernicus Bands State
  const [activeBandsId, setActiveBandsId] = useState<string | null>(null);
  const [bandInfos, setBandInfos] = useState<CopernicusBandInfo[]>([]);
  const [isFetchingBands, setIsFetchingBands] = useState(false);

  // Map selector state
  const [isMapOpen, setIsMapOpen] = useState(false);

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

  const onMapConfirm = (bbox: BBox) => {
    const mockLocation: GeocodingResult = {
      displayName: `Map Selection (${bbox.south.toFixed(2)}°, ${bbox.west.toFixed(2)}° → ${bbox.north.toFixed(2)}°, ${bbox.east.toFixed(2)}°)`,
      lat: (bbox.south + bbox.north) / 2,
      lon: (bbox.west + bbox.east) / 2,
      boundingBox: [bbox.south, bbox.north, bbox.west, bbox.east],
    };
    pickLocation(mockLocation);
    setIsMapOpen(false);
  };

  const onSearch = async () => {
    setHasSearched(true);
    const selectedOpt = SATELLITE_OPTIONS.find(o => o.value === selectedSatellite);
    const currentProvider = selectedOpt?.provider || 'usgs';

    if (currentProvider === 'copernicus') {
      await handleSearch({ startDate, endDate, maxCloudCover, dataset: selectedSatellite, provider: currentProvider, collection: selectedSatellite });
    } else {
      await handleSearch({ startDate, endDate, maxCloudCover, dataset: selectedSatellite, provider: currentProvider });
    }
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
            <p className="explorer-subtitle">Satellite Imagery Search — USGS &amp; Copernicus</p>
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
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <div className="explorer-input-wrap" style={{ flex: 1 }}>
              <input
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                onKeyDown={onLocationKeyDown}
                placeholder="Search city or region…"
                className="explorer-input"
              />
              {isGeocoding && <Loader2 size={14} className="explorer-spin" />}
            </div>
            <button
              onClick={() => setIsMapOpen(true)}
              title="Select area on map"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '36px', height: '36px', minWidth: '36px',
                border: '1px solid #e2e8f0', borderRadius: '8px',
                background: 'linear-gradient(135deg, #0d9488, #14b8a6)',
                color: '#fff', cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <MapIcon size={16} />
            </button>
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

        {/* Satellite Imagery */}
        <div className="explorer-filter-group">
          <label className="explorer-filter-label">
            <Satellite size={13} /> Satellite Imagery
          </label>
          <div className="explorer-select-wrap">
            <select value={selectedSatellite} onChange={(e) => setSelectedSatellite(e.target.value)} className="explorer-select">
              {SATELLITE_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
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
            <p>Select a satellite imagery option, enter a location, set your filters, and hit search.</p>
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
            <h2>Searching…</h2>
            <p>This may take a few seconds.</p>
          </div>
        )}

        {imageryResults.length > 0 && (
          <div className="explorer-grid">
            {imageryResults.map((img) => (
              <div key={img.entityId} className="explorer-card">
                <div className="explorer-card-img">
                  {img.browseUrl ? (
                    <img
                      src={img.browseUrl}
                      alt={img.displayId}
                      loading="lazy"
                      onError={(e) => {
                        // Hide broken image and show fallback
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className="explorer-card-noimg" style={{ display: img.browseUrl ? 'none' : 'flex' }}>
                    <ImageIcon size={28} />
                  </div>
                  <span className="explorer-card-cloud">
                    <Cloud size={11} /> {img.cloudCover.toFixed(1)}%
                  </span>
                  {/* Provider badge */}
                  <span style={{
                    position: 'absolute', top: '8px', left: '8px',
                    background: 'linear-gradient(135deg, #0d9488, #14b8a6)',
                    color: '#fff', fontSize: '10px', fontWeight: 700,
                    padding: '2px 8px', borderRadius: '6px',
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                  }}>
                    {img.provider === 'copernicus'
                      ? (img.dataset?.startsWith('LANDSAT') ? 'Landsat' : 'Sentinel')
                      : 'Landsat'}
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
                      if (img.provider === 'copernicus') {
                        if (activeBandsId === img.entityId) {
                          setActiveBandsId(null);
                        } else {
                          setActiveBandsId(img.entityId);
                          setIsFetchingBands(true);
                          setBandInfos([]);
                          try {
                            const result = await fetchCopernicusBands(img.entityId);
                            if (result.bands) setBandInfos(result.bands);
                          } catch (e) {
                            console.error(e);
                          } finally {
                            setIsFetchingBands(false);
                          }
                        }
                        return;
                      }

                      setDownloadingId(img.entityId);
                      setDownloadError(null);
                      try {
                        const result = await downloadScene(img.entityId, img.dataset, img.provider);
                        if (result.error) {
                          setDownloadError(result.error);
                        } else if (result.downloads.length > 0) {
                          result.downloads.forEach((dl) => {
                            const a = document.createElement('a');
                            a.href = dl.url;
                            a.target = '_blank';
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
                    <span>{downloadingId === img.entityId ? 'Fetching links…' : (img.provider === 'copernicus' ? 'Download Options' : 'Download')}</span>
                  </button>

                  {/* Copernicus Band Selector Dropdown */}
                  {activeBandsId === img.entityId && (
                    <div style={{ marginTop: '8px', padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', width: '100%' }}>
                      <h4 style={{ fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '8px', marginTop: 0 }}>Download Options</h4>
                      <button
                        onClick={async () => {
                          setDownloadingId(img.entityId);
                          setDownloadError(null);
                          setActiveBandsId(null); // Close drawer
                          try {
                            const result = await downloadScene(img.entityId, img.dataset, img.provider);
                            if (result.error) {
                              setDownloadError(result.error);
                            } else if (result.downloads.length > 0) {
                              result.downloads.forEach((dl) => {
                                const a = document.createElement('a');
                                a.href = dl.url;
                                a.target = '_blank';
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
                        style={{ width: '100%', padding: '6px', background: '#e2e8f0', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', marginBottom: '8px', color: '#1e293b', fontWeight: 600, transition: 'background 0.2s' }}
                        onMouseOver={(e) => e.currentTarget.style.background = '#cbd5e1'}
                        onMouseOut={(e) => e.currentTarget.style.background = '#e2e8f0'}
                      >
                        📦 Download Full Product (ZIP)
                      </button>

                      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', fontWeight: 500 }}>Individual Bands (.jp2):</div>
                      {isFetchingBands ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748b' }}>
                          <Loader2 size={12} className="explorer-spin" /> Fetching available files...
                        </div>
                      ) : bandInfos.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '160px', overflowY: 'auto', paddingRight: '4px' }}>
                          {bandInfos.map((b, i) => (
                            <button
                              key={i}
                              onClick={() => window.open(`http://localhost:8000/api/imagery/copernicus/download-band/${img.entityId}?node_path=${encodeURIComponent(b.nodePath)}`, '_blank')}
                              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', color: '#0f172a', transition: 'border-color 0.2s' }}
                              title={b.fullName}
                              onMouseOver={(e) => e.currentTarget.style.borderColor = '#94a3b8'}
                              onMouseOut={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                            >
                              <span style={{ fontWeight: 500 }}>{b.name} <span style={{ color: '#64748b', fontWeight: 400, marginLeft: '2px' }}>({b.resolution})</span></span>
                              {b.size > 0 && <span style={{ color: '#64748b' }}>{(b.size / 1024 / 1024).toFixed(1)} MB</span>}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: '11px', color: '#ef4444' }}>No bands found.</div>
                      )}
                    </div>
                  )}

                  {downloadError && downloadingId === null && activeBandsId !== img.entityId && (
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

      {/* ═══ Map Selector Modal ═══ */}
      {isMapOpen && (
        <Suspense fallback={<div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={32} className="explorer-spin" color="#fff" /></div>}>
          <MapSelector
            onConfirm={onMapConfirm}
            onClose={() => setIsMapOpen(false)}
            initialBounds={selectedLocation ? {
              south: selectedLocation.boundingBox[0],
              north: selectedLocation.boundingBox[1],
              west: selectedLocation.boundingBox[2],
              east: selectedLocation.boundingBox[3],
            } : null}
          />
        </Suspense>
      )}
    </div>
  );
}
