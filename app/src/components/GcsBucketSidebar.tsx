import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X, MoreVertical, Download, FileOutput, Loader2, Globe,
  Map, Layers, FileType2, CheckCircle2, AlertCircle, Folder,
  Search, LayoutTemplate, LayoutGrid, LayoutPanelLeft
} from 'lucide-react';
import {
  listGcsFiles, listGcsExports, getGcsDownloadUrl, submitBatchExport,
  getBatchExportStatus, triggerDownload,
  type GcsFileItem,
} from '@/api/gcsApi';

interface GcsBucketSidebarProps {
  open: boolean;
  onClose: () => void;
}

const RASTER_FORMATS = [
  { id: 'geotiff', name: 'GeoTIFF', ext: '.tif', icon: '🗺️' },
  { id: 'png', name: 'PNG + World', ext: '.png', icon: '🖼️' },
  { id: 'jpeg', name: 'JPEG', ext: '.jpg', icon: '📷' },
];

const VECTOR_FORMATS = [
  { id: 'geojson', name: 'GeoJSON', ext: '.geojson', icon: '📐' },
  { id: 'shapefile', name: 'Shapefile', ext: '.shp.zip', icon: '📦' },
  { id: 'kml', name: 'KML', ext: '.kml', icon: '🌍' },
];

interface CrsItem {
  code: number;
  name: string;
  category: string;
}

const CRS_LIST: CrsItem[] = [
  { code: 4326, name: 'WGS 84', category: 'Geographic' },
  { code: 4269, name: 'NAD83', category: 'Geographic' },
  { code: 4258, name: 'ETRS89', category: 'Geographic' },
  { code: 3857, name: 'Web Mercator', category: 'Web' },
  { code: 32636, name: 'UTM Zone 36N', category: 'UTM North' },
  { code: 32637, name: 'UTM Zone 37N', category: 'UTM North' },
  { code: 32617, name: 'UTM Zone 17N', category: 'UTM North' },
  { code: 32618, name: 'UTM Zone 18N', category: 'UTM North' },
  { code: 32632, name: 'UTM Zone 32N', category: 'UTM North' },
  { code: 32633, name: 'UTM Zone 33N', category: 'UTM North' },
  { code: 22992, name: 'Egypt 1907 / Red Belt', category: 'Regional' },
  { code: 27700, name: 'British National Grid', category: 'Regional' },
  { code: 2154, name: 'Lambert-93 (France)', category: 'Regional' },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
}

export function GcsBucketSidebar({ open, onClose }: GcsBucketSidebarProps) {
  const [files, setFiles] = useState<GcsFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  // Export modal state
  const [exportFile, setExportFile] = useState<GcsFileItem | null>(null);
  const [exportFormat, setExportFormat] = useState<string | null>(null);
  const [exportState, setExportState] = useState<'idle' | 'submitting' | 'polling' | 'success' | 'error'>('idle');
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState('');
  const [showExportToast, setShowExportToast] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTypeTab, setActiveTypeTab] = useState('all');

  const [enableReproject, setEnableReproject] = useState(false);
  const [selectedCrs, setSelectedCrs] = useState<number | null>(null);
  const [crsSearch, setCrsSearch] = useState('');

  const filteredCrs = useMemo(() => {
    if (!crsSearch.trim()) return CRS_LIST;
    const q = crsSearch.toLowerCase();
    return CRS_LIST.filter(
      c => c.name.toLowerCase().includes(q) || c.code.toString().includes(q)
    );
  }, [crsSearch]);

  // Fun tips that rotate during export processing
  const EXPORT_TIPS = [
    '🌍 Did you know? GeoJSON is the most popular open vector format on the web!',
    '📡 Your data is being processed on Google Cloud at lightning speed.',
    '🗺️ Shapefiles were introduced by ESRI in 1998 and are still widely used today.',
    '⚡ We automatically pick the best server size for your file — smart exports!',
    '🛰️ GeoTIFF files can store satellite imagery with full geospatial metadata.',
    '🧠 Our adaptive sampling tests your file first to ensure a smooth conversion.',
    '📦 KML files can be viewed directly in Google Earth — try it!',
    '🌐 EPSG:4326 (WGS 84) is the coordinate system used by GPS worldwide.',
    '☕ Perfect time for a coffee break while we handle the heavy lifting!',
    '🚀 Large files are processed on servers with up to 416 GB of RAM.',
  ];
  const [tipIndex, setTipIndex] = useState(0);
  const [tipFade, setTipFade] = useState(true);

  // Rotate tips every 6 seconds during export
  useEffect(() => {
    if (exportState !== 'submitting' && exportState !== 'polling') return;
    const interval = setInterval(() => {
      setTipFade(false);
      setTimeout(() => {
        setTipIndex(prev => (prev + 1) % EXPORT_TIPS.length);
        setTipFade(true);
      }, 400);
    }, 6000);
    return () => clearInterval(interval);
  }, [exportState]);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Close menus on click outside (but DO NOT close the sidebar)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      // Close only dropdown menus
      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpenFor(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchFiles = useCallback(async (source?: string) => {
    setLoading(true);
    setError(null);
    try {
      const currentSource = source || activeTypeTab;
      let data;
      if (currentSource === 'exports') {
        data = await listGcsExports();
      } else if (currentSource === 'osm_exports') {
        // Fetch files specifically from the osm_exports folder
        data = await listGcsFiles(undefined, 'osm_exports/');
      } else {
        data = await listGcsFiles(); // Defaults to sample/
      }
      
      // Sort by updated descending (newest first)
      const sorted = data.files.sort((a, b) => {
        if (!a.updated) return 1;
        if (!b.updated) return -1;
        return new Date(b.updated).getTime() - new Date(a.updated).getTime();
      });
      setFiles(sorted);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch files');
    } finally {
      setLoading(false);
    }
  }, [activeTypeTab]);

  // Fetch files when sidebar opens
  useEffect(() => {
    if (open) {
      fetchFiles();
      setMenuOpenFor(null);
    }
  }, [open, fetchFiles]);

  // Listen for background uploads to refresh the list
  useEffect(() => {
    const handleBucketChanged = () => {
      if (open) fetchFiles();
    };
    window.addEventListener('gcs-bucket-changed', handleBucketChanged);
    return () => window.removeEventListener('gcs-bucket-changed', handleBucketChanged as any);
  }, [open, fetchFiles]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // ─── Download Handler ─────────────────────────────────────────────────
  const handleDownload = async (file: GcsFileItem) => {
    setDownloadingFile(file.name);
    setMenuOpenFor(null);
    try {
      const res = await getGcsDownloadUrl(file.gcs_uri);
      triggerDownload(res.download_url, res.filename);
    } catch (e: any) {
      alert(`Download failed: ${e.message}`);
    } finally {
      setDownloadingFile(null);
    }
  };

  // ─── Export Handlers ──────────────────────────────────────────────────
  const openExportModal = (file: GcsFileItem) => {
    // If we're already processing another file, don't allow starting a new one right now.
    if (['submitting', 'polling'].includes(exportState) && exportFile?.gcs_uri !== file.gcs_uri) {
      alert("An export is already in progress. Please wait for it to finish.");
      return;
    }

    setExportFile(file);
    if (!['submitting', 'polling', 'success'].includes(exportState)) {
      setExportFormat(null);
      setExportState('idle');
      setExportMessage('');
    }
    setMenuOpenFor(null);
    setShowExportToast(true);
  };

  const closeExportModal = () => {
    // If the process is still running, just hide the toast but DO NOT cancel the job tracking!
    if (!['submitting', 'polling'].includes(exportState)) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      setExportFile(null);
      setExportState('idle');
      setExportJobId(null);
      setExportMessage('');
      setEnableReproject(false);
      setSelectedCrs(null);
      setCrsSearch('');
    }
    setShowExportToast(false);
  };

  const startExport = async () => {
    if (!exportFile || !exportFormat) return;
    setExportState('submitting');
    setExportMessage('Submitting batch export job...');

    try {
      const res = await submitBatchExport(
        exportFile.gcs_uri, 
        exportFormat,
        enableReproject && selectedCrs ? selectedCrs : undefined
      );
      setExportJobId(res.job_id);
      setExportState('polling');
      setExportMessage('Job submitted. Waiting for completion...');

      // Start polling
      pollingRef.current = setInterval(async () => {
        try {
          const status = await getBatchExportStatus(res.job_id);

          if (status.status === 'SUCCEEDED') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setExportState('success');
            setExportMessage('Export complete! Downloading...');

            // Auto-download the output
            if (status.download_url) {
              const dlRes = await fetch(
                `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${status.download_url}`
              ).then(r => r.json());
              triggerDownload(dlRes.download_url, dlRes.filename);
            }
          } else if (status.status === 'FAILED') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setExportState('error');
            setExportMessage(status.message || 'Export job failed. Please try again.');
          } else {
            setExportMessage(`Job status: ${status.status}...`);
          }
        } catch {
          // Keep polling even if one check fails
        }
      }, 10000); // Poll every 10 seconds
    } catch (e: any) {
      setExportState('error');
      setExportMessage(`Failed to submit: ${e.message}`);
    }
  };

  if (!open) return null;

  const formats = exportFile
    ? exportFile.file_type === 'raster' ? RASTER_FORMATS : VECTOR_FORMATS
    : [];

  return (
    <>
      {/* Sidebar Panel - Data Catalog Style */}
      <div className="gcs-sidebar" ref={sidebarRef}>
        {/* Header */}
        <div className="gcs-sidebar-header">
          <div className="gcs-sidebar-header-left">
            <Folder size={18} />
            <h3>Data Catalog</h3>
          </div>
          <div className="gcs-sidebar-header-actions">
            <button className="gcs-sidebar-icon-btn" onClick={onClose} title="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="gcs-search-container">
          <div className="gcs-search-input-wrapper">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search files..."
              className="gcs-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Type Filter Toggles */}
        <div className="gcs-type-filter">
          <span className="gcs-type-label">TYPE</span>
          <div className="gcs-type-toggles">
            <button
              className={`gcs-type-btn ${activeTypeTab === 'all' ? 'active' : ''}`}
              title="All Files"
              onClick={() => { setActiveTypeTab('all'); fetchFiles('all'); }}
            >
              <LayoutTemplate size={16} />
            </button>
            <button
              className={`gcs-type-btn ${activeTypeTab === 'raster' ? 'active' : ''}`}
              title="Raster Files"
              onClick={() => { setActiveTypeTab('raster'); fetchFiles('raster'); }}
            >
              <Map size={16} />
            </button>
            <button
              className={`gcs-type-btn ${activeTypeTab === 'vector' ? 'active' : ''}`}
              title="Vector Files"
              onClick={() => { setActiveTypeTab('vector'); fetchFiles('vector'); }}
            >
              <Layers size={16} />
            </button>
            <button
              className={`gcs-type-btn ${activeTypeTab === 'osm_exports' ? 'active' : ''}`}
              title="OSM Vector Exports"
              onClick={() => { setActiveTypeTab('osm_exports'); fetchFiles('osm_exports'); }}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              className={`gcs-type-btn ${activeTypeTab === 'exports' ? 'active' : ''}`}
              title="Export Results"
              onClick={() => { setActiveTypeTab('exports'); fetchFiles('exports'); }}
            >
              <LayoutPanelLeft size={16} />
            </button>
          </div>
        </div>

        {/* File List */}
        <div className="gcs-sidebar-body">
          {loading && files.length === 0 && (
            <div className="gcs-sidebar-loading">
              <Loader2 size={24} className="gcs-spin" />
              <p>Loading files...</p>
            </div>
          )}

          {error && (
            <div className="gcs-sidebar-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && files.length === 0 && (
            <div className="gcs-sidebar-empty">
              No files uploaded.
            </div>
          )}

          <div className="gcs-sidebar-files" ref={menuRef}>
            {files
              .filter(file => file.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .filter(file => {
                if (activeTypeTab === 'all') return true;
                if (activeTypeTab === 'raster') return file.file_type === 'raster';
                if (activeTypeTab === 'vector') return file.file_type === 'vector';
                // For 'grid' and 'panel' just return true until a layout change is requested
                return true;
              })
              .map((file) => {
                const isMenuOpen = menuOpenFor === file.name;
                const isDownloading = downloadingFile === file.name;
                const isExporting = exportFile?.name === file.name && ['submitting', 'polling'].includes(exportState);
                const isProcessing = isDownloading || isExporting;

                return (
                  <div key={file.gcs_uri} className={`gcs-file-item ${isProcessing ? 'gcs-file-item--processing' : ''}`}>
                    <div className="gcs-file-icon">
                      {file.file_type === 'raster' ? (
                        <Map size={18} />
                      ) : file.file_type === 'vector' ? (
                        <Layers size={18} />
                      ) : (
                        <FileType2 size={18} />
                      )}
                    </div>
                    <div className="gcs-file-info">
                      <div className="gcs-file-name" title={file.name}>
                        {file.name}
                      </div>
                      <div className="gcs-file-meta">
                        <span className={`gcs-file-type-badge gcs-file-type-badge--${file.file_type}`}>
                          {file.file_type.toUpperCase()}
                        </span>
                        <span>{formatBytes(file.size_bytes)}</span>
                      </div>
                    </div>

                    {/* Processing Badge or 3-dot Menu */}
                    {isProcessing ? (
                      <div className="gcs-file-processing-badge">
                        <Loader2 size={14} className="gcs-spin" />
                        {isDownloading ? 'Downloading...' : 'Processing...'}
                      </div>
                    ) : (
                      <>
                        <button
                          className="gcs-file-menu-btn"
                          onClick={() => setMenuOpenFor(isMenuOpen ? null : file.name)}
                        >
                          <MoreVertical size={16} />
                        </button>

                        {/* Dropdown */}
                        {/* Dropdown */}
                        {isMenuOpen && (
                          <div className="gcs-file-dropdown">
                            <button className="gcs-file-dropdown-item" onClick={() => handleDownload(file)}>
                              <Download size={14} />
                              <span>Download</span>
                            </button>
                            {file.file_type !== 'unknown' && (
                              <button className="gcs-file-dropdown-item" onClick={() => openExportModal(file)}>
                                <FileOutput size={14} />
                                <span>Export</span>
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Export Toast / Popup */}
      {exportFile && showExportToast && (
        <div className="export-toast-overlay">
          <div className="export-modal" style={{ maxWidth: '340px' }}>
            <div className="export-modal-header">
              <h2>Export File</h2>
              <button className="export-modal-close" onClick={closeExportModal}>✕</button>
            </div>

            <div className="export-modal-body" style={{ padding: '20px 24px' }}>
              {/* Selected file info */}
              <div className="gcs-export-file-info">
                <div className="gcs-export-file-icon">
                  {exportFile.file_type === 'raster' ? <Map size={20} /> : <Layers size={20} />}
                </div>
                <div className="gcs-export-file-text">
                  <div className="gcs-export-file-name" title={exportFile.name}>{exportFile.name}</div>
                  <div className="gcs-export-file-meta">
                    {exportFile.file_type.toUpperCase()} • {formatBytes(exportFile.size_bytes)}
                  </div>
                </div>
              </div>

              {/* Format Selection */}
              {exportState === 'idle' && (
                <>
                  <h3 className="export-group-title" style={{ margin: '16px 0 12px' }}>
                    Select Export Format
                  </h3>
                  <div className="export-format-grid">
                    {formats.map((fmt) => (
                      <button
                        key={fmt.id}
                        className={`export-format-card ${exportFormat === fmt.id ? 'selected' : ''}`}
                        onClick={() => setExportFormat(fmt.id)}
                      >
                        <div className="export-format-icon">{fmt.icon}</div>
                        <div className="export-format-name">{fmt.name}</div>
                        <div className="export-format-ext">{fmt.ext}</div>
                      </button>
                    ))}
                  </div>

                  {/* CRS Reprojection Toggle */}
                  {exportFormat && (
                    <div className="crs-section">
                      <div className="crs-toggle-row">
                        <label className="crs-toggle-label">
                          <input
                            type="checkbox"
                            className="crs-toggle-checkbox"
                            checked={enableReproject}
                            onChange={(e) => {
                              setEnableReproject(e.target.checked);
                              if (!e.target.checked) setSelectedCrs(null);
                            }}
                          />
                          <span className="crs-toggle-switch" />
                          <span className="crs-toggle-text">🔄 Reproject CRS</span>
                        </label>
                        {enableReproject && selectedCrs && (
                          <span className="crs-selected-badge">
                            EPSG:{selectedCrs}
                          </span>
                        )}
                      </div>

                      {/* CRS Picker Panel */}
                      {enableReproject && (
                        <div className="crs-picker">
                          <input
                            type="text"
                            className="crs-search"
                            placeholder="Search CRS..."
                            value={crsSearch}
                            onChange={(e) => setCrsSearch(e.target.value)}
                          />
                          <div className="crs-list" style={{ maxHeight: '160px' }}>
                            {filteredCrs.map((crs) => (
                              <button
                                key={crs.code}
                                className={`crs-item ${selectedCrs === crs.code ? 'selected' : ''}`}
                                onClick={() => setSelectedCrs(crs.code)}
                              >
                                <span className="crs-item-code">EPSG:{crs.code}</span>
                                <span className="crs-item-name">{crs.name}</span>
                              </button>
                            ))}
                            {filteredCrs.length === 0 && (
                              <div className="crs-no-results">No CRS found</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Submitting / Polling */}
              {(exportState === 'submitting' || exportState === 'polling') && (
                <div className="export-progress-section">
                  <div className="export-progress-spinner" />
                  <div className="export-progress-info">
                    <div className="export-progress-status">{exportMessage}</div>
                    {exportJobId && (
                      <div style={{ fontSize: '11px', color: 'var(--griid-gray-400)', fontFamily: 'monospace', marginBottom: '6px' }}>
                        Job: {exportJobId}
                      </div>
                    )}
                    <div style={{ fontSize: '12px', color: 'var(--griid-gray-500)', marginTop: '4px', fontStyle: 'italic' }}>
                      This process may take several minutes depending on file size.
                    </div>
                    <div
                      style={{
                        marginTop: '14px',
                        padding: '10px 12px',
                        background: 'rgba(99, 102, 241, 0.08)',
                        borderRadius: '8px',
                        borderLeft: '3px solid rgba(99, 102, 241, 0.5)',
                        fontSize: '13px',
                        color: '#111827', // Dark/Black text for readability
                        fontWeight: 500,
                        lineHeight: '1.5',
                        transition: 'opacity 0.4s ease',
                        opacity: tipFade ? 1 : 0,
                        minHeight: '40px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <Globe size={16} className="gcs-spin" style={{ marginRight: '10px', color: '#6366f1', flexShrink: 0 }} />
                      <span>{EXPORT_TIPS[tipIndex]}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Success */}
              {exportState === 'success' && (
                <div className="export-success-section">
                  <div className="export-success-icon">
                    <CheckCircle2 size={28} />
                  </div>
                  <div className="export-success-text">Export Complete!</div>
                  <p style={{ fontSize: '12px', color: 'var(--griid-gray-500)' }}>
                    Your file has been downloaded automatically.
                  </p>
                </div>
              )}

              {/* Error */}
              {exportState === 'error' && (
                <div className="export-error-section">
                  <div className="export-error-icon">
                    <AlertCircle size={28} />
                  </div>
                  <div className="export-error-text">Export Failed</div>
                  <p style={{ fontSize: '12px', color: 'var(--griid-gray-500)', marginBottom: '16px' }}>
                    {exportMessage}
                  </p>
                  <button className="export-retry-btn" onClick={() => setExportState('idle')}>
                    Try Again
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            {exportState === 'idle' && (
              <div className="export-modal-footer">
                <button className="export-cancel-btn" onClick={closeExportModal}>Cancel</button>
                <button
                  className="export-start-btn"
                  disabled={!exportFormat || (enableReproject && !selectedCrs)}
                  onClick={startExport}
                >
                  {enableReproject && selectedCrs ? `Export (EPSG:${selectedCrs})` : 'Start Export'}
                </button>
              </div>
            )}

            {(exportState === 'success' || exportState === 'error') && (
              <div className="export-modal-footer">
                <button className="export-cancel-btn" onClick={closeExportModal}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
