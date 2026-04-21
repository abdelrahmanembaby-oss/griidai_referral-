/**
 * ExportModal – format selection + CRS reprojection + progress + download
 *
 * Props:
 *   open       – whether the modal is visible
 *   onClose    – close callback
 *   fileId     – the entity / product ID to export
 *   sourceUrl  – optional direct URL to file
 *   provider   – source provider (usgs, copernicus, local)
 */
import { useState, useEffect, useMemo } from 'react';
import { useExport } from '@/hooks/useExport';
import type { ExportFormat } from '@/types/export';
import { toast } from 'sonner';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  fileId: string;
  sourceUrl?: string;
  provider?: string;
}

interface CrsItem {
  code: number;
  name: string;
  category: string;
}

const FORMAT_GROUPS = {
  vector: [
    { id: 'geojson' as ExportFormat, name: 'GeoJSON', ext: '.geojson', icon: '{ }', desc: 'Lightweight, web-friendly vector format' },
    { id: 'shapefile' as ExportFormat, name: 'ESRI Shapefile', ext: '.shp.zip', icon: '▦', desc: 'Industry-standard GIS format (zipped)' },
    { id: 'kml' as ExportFormat, name: 'KML', ext: '.kml', icon: '🌍', desc: 'Google Earth compatible' },
  ],
  raster: [
    { id: 'geotiff' as ExportFormat, name: 'GeoTIFF', ext: '.tif', icon: '🗺️', desc: 'Georeferenced raster with LZW compression' },
    { id: 'png' as ExportFormat, name: 'PNG + World File', ext: '.png', icon: '🖼️', desc: 'Portable image with georeference sidecar' },
    { id: 'jpeg' as ExportFormat, name: 'JPEG', ext: '.jpg', icon: '📷', desc: 'Compressed 3-band RGB image' },
  ],
};

// Curated CRS list (same as backend)
const CRS_LIST: CrsItem[] = [
  { code: 4326, name: 'WGS 84', category: 'Geographic' },
  { code: 4269, name: 'NAD83', category: 'Geographic' },
  { code: 4267, name: 'NAD27', category: 'Geographic' },
  { code: 4258, name: 'ETRS89', category: 'Geographic' },
  { code: 4674, name: 'SIRGAS 2000', category: 'Geographic' },
  { code: 3857, name: 'Web Mercator (Pseudo-Mercator)', category: 'Web' },
  { code: 32610, name: 'UTM Zone 10N (WGS 84)', category: 'UTM North' },
  { code: 32611, name: 'UTM Zone 11N (WGS 84)', category: 'UTM North' },
  { code: 32612, name: 'UTM Zone 12N (WGS 84)', category: 'UTM North' },
  { code: 32613, name: 'UTM Zone 13N (WGS 84)', category: 'UTM North' },
  { code: 32614, name: 'UTM Zone 14N (WGS 84)', category: 'UTM North' },
  { code: 32615, name: 'UTM Zone 15N (WGS 84)', category: 'UTM North' },
  { code: 32616, name: 'UTM Zone 16N (WGS 84)', category: 'UTM North' },
  { code: 32617, name: 'UTM Zone 17N (WGS 84)', category: 'UTM North' },
  { code: 32618, name: 'UTM Zone 18N (WGS 84)', category: 'UTM North' },
  { code: 32619, name: 'UTM Zone 19N (WGS 84)', category: 'UTM North' },
  { code: 32620, name: 'UTM Zone 20N (WGS 84)', category: 'UTM North' },
  { code: 32630, name: 'UTM Zone 30N (WGS 84)', category: 'UTM North' },
  { code: 32631, name: 'UTM Zone 31N (WGS 84)', category: 'UTM North' },
  { code: 32632, name: 'UTM Zone 32N (WGS 84)', category: 'UTM North' },
  { code: 32633, name: 'UTM Zone 33N (WGS 84)', category: 'UTM North' },
  { code: 32634, name: 'UTM Zone 34N (WGS 84)', category: 'UTM North' },
  { code: 32635, name: 'UTM Zone 35N (WGS 84)', category: 'UTM North' },
  { code: 32636, name: 'UTM Zone 36N (WGS 84)', category: 'UTM North' },
  { code: 32637, name: 'UTM Zone 37N (WGS 84)', category: 'UTM North' },
  { code: 32638, name: 'UTM Zone 38N (WGS 84)', category: 'UTM North' },
  { code: 32639, name: 'UTM Zone 39N (WGS 84)', category: 'UTM North' },
  { code: 32640, name: 'UTM Zone 40N (WGS 84)', category: 'UTM North' },
  { code: 32717, name: 'UTM Zone 17S (WGS 84)', category: 'UTM South' },
  { code: 32718, name: 'UTM Zone 18S (WGS 84)', category: 'UTM South' },
  { code: 32719, name: 'UTM Zone 19S (WGS 84)', category: 'UTM South' },
  { code: 32720, name: 'UTM Zone 20S (WGS 84)', category: 'UTM South' },
  { code: 32733, name: 'UTM Zone 33S (WGS 84)', category: 'UTM South' },
  { code: 32734, name: 'UTM Zone 34S (WGS 84)', category: 'UTM South' },
  { code: 32735, name: 'UTM Zone 35S (WGS 84)', category: 'UTM South' },
  { code: 32736, name: 'UTM Zone 36S (WGS 84)', category: 'UTM South' },
  { code: 2154, name: 'RGF93 / Lambert-93 (France)', category: 'Regional' },
  { code: 27700, name: 'OSGB 1936 / British National Grid', category: 'Regional' },
  { code: 28992, name: 'Amersfoort / RD New (Netherlands)', category: 'Regional' },
  { code: 22992, name: 'Egypt 1907 / Red Belt', category: 'Regional' },
  { code: 20436, name: 'Ain el Abd / UTM Zone 36N (Saudi)', category: 'Regional' },
  { code: 2100, name: 'GGRS87 / Greek Grid', category: 'Regional' },
];

export function ExportModal({ open, onClose, fileId, sourceUrl, provider }: ExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat | null>(null);
  const [enableReproject, setEnableReproject] = useState(false);
  const [selectedCrs, setSelectedCrs] = useState<number | null>(null);
  const [crsSearch, setCrsSearch] = useState('');
  const { startExport, status, progress, message, downloadUrl, error, isExporting, reset } = useExport();

  // Filter CRS based on search
  const filteredCrs = useMemo(() => {
    if (!crsSearch.trim()) return CRS_LIST;
    const q = crsSearch.toLowerCase();
    return CRS_LIST.filter(
      c => c.name.toLowerCase().includes(q) || c.code.toString().includes(q) || c.category.toLowerCase().includes(q)
    );
  }, [crsSearch]);

  // Group CRS by category
  const groupedCrs = useMemo(() => {
    const groups: Record<string, CrsItem[]> = {};
    filteredCrs.forEach(c => {
      if (!groups[c.category]) groups[c.category] = [];
      groups[c.category].push(c);
    });
    return groups;
  }, [filteredCrs]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedFormat(null);
      setEnableReproject(false);
      setSelectedCrs(null);
      setCrsSearch('');
      reset();
    }
  }, [open, reset]);

  // Show toast when export succeeds or fails
  useEffect(() => {
    if (status === 'SUCCESS' && downloadUrl) {
      toast.success('Export complete! Your file is ready to download.');
    } else if (status === 'FAILURE' && error) {
      toast.error(`Export failed: ${error}`);
    }
  }, [status, downloadUrl, error]);

  const handleExport = async () => {
    if (!selectedFormat) return;
    await startExport({
      file_id: fileId,
      target_format: selectedFormat,
      source_url: sourceUrl,
      provider: provider || 'local',
      ...(enableReproject && selectedCrs ? { target_crs: selectedCrs } : {}),
    });
  };

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  };

  if (!open) return null;

  return (
    <div className="export-modal-overlay" onClick={onClose}>
      <div className="export-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="export-modal-header">
          <h2>Export As...</h2>
          <button className="export-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="export-modal-body">
          {/* Format selection (only show when not exporting) */}
          {!isExporting && status !== 'SUCCESS' && (
            <>
              {/* Vector Formats */}
              <div className="export-format-group">
                <h3 className="export-group-title">Vector Formats</h3>
                <div className="export-format-grid">
                  {FORMAT_GROUPS.vector.map((fmt) => (
                    <button
                      key={fmt.id}
                      className={`export-format-card ${selectedFormat === fmt.id ? 'selected' : ''}`}
                      onClick={() => setSelectedFormat(fmt.id)}
                    >
                      <span className="export-format-icon">{fmt.icon}</span>
                      <span className="export-format-name">{fmt.name}</span>
                      <span className="export-format-ext">{fmt.ext}</span>
                      <span className="export-format-desc">{fmt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Raster Formats */}
              <div className="export-format-group">
                <h3 className="export-group-title">Raster Formats</h3>
                <div className="export-format-grid">
                  {FORMAT_GROUPS.raster.map((fmt) => (
                    <button
                      key={fmt.id}
                      className={`export-format-card ${selectedFormat === fmt.id ? 'selected' : ''}`}
                      onClick={() => setSelectedFormat(fmt.id)}
                    >
                      <span className="export-format-icon">{fmt.icon}</span>
                      <span className="export-format-name">{fmt.name}</span>
                      <span className="export-format-ext">{fmt.ext}</span>
                      <span className="export-format-desc">{fmt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* CRS Reprojection Toggle */}
              {selectedFormat && (
                <div className="crs-section">
                  <div className="crs-toggle-row">
                    <label className="crs-toggle-label">
                      <input
                        type="checkbox"
                        className="crs-toggle-checkbox"
                        checked={enableReproject}
                        onChange={(e) => {
                          setEnableReproject(e.target.checked);
                          if (!e.target.checked) {
                            setSelectedCrs(null);
                            setCrsSearch('');
                          }
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
                        placeholder="Search CRS (name or EPSG code)..."
                        value={crsSearch}
                        onChange={(e) => setCrsSearch(e.target.value)}
                        autoFocus
                      />
                      <div className="crs-list">
                        {Object.entries(groupedCrs).map(([category, items]) => (
                          <div key={category} className="crs-group">
                            <div className="crs-group-title">{category}</div>
                            {items.map((crs) => (
                              <button
                                key={crs.code}
                                className={`crs-item ${selectedCrs === crs.code ? 'selected' : ''}`}
                                onClick={() => setSelectedCrs(crs.code)}
                              >
                                <span className="crs-item-code">EPSG:{crs.code}</span>
                                <span className="crs-item-name">{crs.name}</span>
                              </button>
                            ))}
                          </div>
                        ))}
                        {filteredCrs.length === 0 && (
                          <div className="crs-no-results">No CRS found for "{crsSearch}"</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Progress indicator */}
          {isExporting && (
            <div className="export-progress-section">
              <div className="export-progress-spinner" />
              <div className="export-progress-info">
                <p className="export-progress-status">{message || 'Processing...'}</p>
                <div className="export-progress-bar-bg">
                  <div
                    className="export-progress-bar-fill"
                    style={{ width: `${Math.max(progress, 5)}%` }}
                  />
                </div>
                <p className="export-progress-pct">{progress}%</p>
              </div>
            </div>
          )}

          {/* Success state */}
          {status === 'SUCCESS' && downloadUrl && (
            <div className="export-success-section">
              <div className="export-success-icon">✓</div>
              <p className="export-success-text">Your file is ready!</p>
              <button className="export-download-btn" onClick={handleDownload}>
                ⬇ Download File
              </button>
            </div>
          )}

          {/* Failure state */}
          {status === 'FAILURE' && (
            <div className="export-error-section">
              <div className="export-error-icon">✗</div>
              <p className="export-error-text">{error || 'Something went wrong'}</p>
              <button className="export-retry-btn" onClick={reset}>
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="export-modal-footer">
          <button className="export-cancel-btn" onClick={onClose}>
            {status === 'SUCCESS' ? 'Close' : 'Cancel'}
          </button>
          {!isExporting && status !== 'SUCCESS' && status !== 'FAILURE' && (
            <button
              className="export-start-btn"
              disabled={!selectedFormat || (enableReproject && !selectedCrs)}
              onClick={handleExport}
            >
              {enableReproject && selectedCrs ? `Export (EPSG:${selectedCrs})` : 'Export'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
