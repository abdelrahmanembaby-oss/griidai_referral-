import { useState, useRef, useEffect, useMemo } from 'react';
import { UploadCloud, FileType2, MoreVertical, Layers, Map, Trash2, RefreshCw } from 'lucide-react';
import { useUploads } from '@/hooks/useUploads';
import type { UploadedFile } from '@/services/gisUpload';

interface UploadExportModalProps {
  open: boolean;
  onClose: () => void;
}

interface CrsItem {
  code: number;
  name: string;
  category: string;
}

const RASTER_FORMATS = [
  { id: 'geotiff', name: 'GeoTIFF', ext: '.tif' },
  { id: 'png', name: 'PNG + World', ext: '.png' },
  { id: 'jpeg', name: 'JPEG', ext: '.jpg' },
];

const VECTOR_FORMATS = [
  { id: 'geojson', name: 'GeoJSON', ext: '.geojson' },
  { id: 'shapefile', name: 'Shapefile', ext: '.shp.zip' },
  { id: 'kml', name: 'KML', ext: '.kml' },
];

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
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
}

export function UploadExportModal({ open, onClose }: UploadExportModalProps) {
  const [menuOpenForId, setMenuOpenForId] = useState<string | null>(null);
  // CRS picker state: tracks which file+format is being configured
  const [crsPickerFor, setCrsPickerFor] = useState<{ filename: string; formatId: string } | null>(null);
  const [selectedCrs, setSelectedCrs] = useState<number | null>(null);
  const [crsSearch, setCrsSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    files,
    isLoading,
    exportingFile,
    handleUpload,
    handleDelete,
    handleExport,
    refreshList,
  } = useUploads();

  const filteredCrs = useMemo(() => {
    if (!crsSearch.trim()) return CRS_LIST;
    const q = crsSearch.toLowerCase();
    return CRS_LIST.filter(
      c => c.name.toLowerCase().includes(q) || c.code.toString().includes(q)
    );
  }, [crsSearch]);

  useEffect(() => {
    if (open) {
      refreshList();
    } else {
      setMenuOpenForId(null);
      setCrsPickerFor(null);
      setSelectedCrs(null);
      setCrsSearch('');
    }
  }, [open, refreshList]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleUpload(e.target.files[0]);
    }
  };

  const handleFormatClick = (file: UploadedFile, formatId: string) => {
    // Show CRS picker for this file+format
    setCrsPickerFor({ filename: file.filename, formatId });
    setSelectedCrs(null);
    setCrsSearch('');
    setMenuOpenForId(null);
  };

  const handleExportWithCrs = (file: UploadedFile) => {
    if (!crsPickerFor) return;
    handleExport(file, crsPickerFor.formatId, selectedCrs || undefined);
    setCrsPickerFor(null);
    setSelectedCrs(null);
    setCrsSearch('');
  };

  const handleExportWithoutCrs = (file: UploadedFile) => {
    if (!crsPickerFor) return;
    handleExport(file, crsPickerFor.formatId);
    setCrsPickerFor(null);
    setSelectedCrs(null);
    setCrsSearch('');
  };

  if (!open) return null;

  return (
    <div className="export-modal-overlay" onClick={onClose}>
      <div className="export-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="export-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>My Geographic Files</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="sidebar-icon-btn" onClick={refreshList} title="Refresh">
              <RefreshCw size={16} />
            </button>
            <button className="export-modal-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        <div className="export-modal-body" style={{ padding: '16px 20px', maxHeight: '60vh', overflowY: 'auto' }}>
          {/* Upload Zone */}
          <div className="export-format-group" style={{ marginBottom: '24px' }}>
            <div 
              className="export-dropzone"
              onClick={() => fileInputRef.current?.click()}
              style={{ cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1 }}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }}
                onChange={handleFileChange}
                disabled={isLoading}
                accept=".parquet,.json,.geojson,.tif,.tiff,.png,.jpg,.jpeg,.kml,.shp,.zip"
              />
              <div className="export-dropzone-icon">
                <UploadCloud size={24} />
              </div>
              <p className="export-dropzone-title">
                {isLoading ? "Uploading..." : "Click to upload a spatial file"}
              </p>
              <p className="export-dropzone-subtitle" style={{ fontSize: '11px' }}>
                Supports Parquet, GeoTIFF, GeoJSON, Shapefile
              </p>
            </div>
          </div>

          <h3 className="export-group-title" style={{ marginBottom: '12px' }}>Uploaded Files</h3>

          {/* Uploaded Files List */}
          {files.length === 0 && !isLoading && (
            <div style={{ textAlign: 'center', color: 'var(--griid-text-secondary)', fontSize: '12px', padding: '20px 0' }}>
              No files uploaded yet.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {files.map((file) => {
              const isExporting = exportingFile === file.filename;
              const formats = file.file_type === 'raster' ? RASTER_FORMATS : VECTOR_FORMATS;
              const isMenuOpen = menuOpenForId === file.filename;
              const isCrsPickerOpen = crsPickerFor?.filename === file.filename;

              return (
                <div key={file.filename} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  background: 'var(--griid-surface)',
                  border: '1px solid var(--griid-border)',
                  borderRadius: '8px',
                  position: 'relative'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px' }}>
                    <div style={{ marginRight: '12px', color: file.file_type === 'raster' ? '#fbbf24' : '#38bdf8' }}>
                      {file.file_type === 'raster' ? <Map size={18} /> : 
                       file.file_type === 'vector' ? <Layers size={18} /> : 
                       <FileType2 size={18} />}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--griid-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {file.filename}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--griid-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                        <span>{file.file_type.toUpperCase()}</span>
                        <span>•</span>
                        <span>{formatBytes(file.size_bytes)}</span>
                        {isExporting && (
                          <>
                            <span>•</span>
                            <span style={{ color: 'var(--griid-teal)' }}>Exporting...</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 3 Dots Menu Button */}
                    <button 
                      style={{ background: 'none', border: 'none', color: 'var(--griid-text-secondary)', cursor: 'pointer', padding: '4px' }}
                      onClick={() => {
                        setMenuOpenForId(isMenuOpen ? null : file.filename);
                        setCrsPickerFor(null);
                      }}
                      disabled={isExporting}
                    >
                      <MoreVertical size={16} />
                    </button>

                    {/* Dropdown Menu */}
                    {isMenuOpen && (
                      <div style={{
                        position: 'absolute',
                        right: '0',
                        top: '100%',
                        marginTop: '4px',
                        background: 'var(--griid-surface-lighter)',
                        border: '1px solid var(--griid-border)',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        zIndex: 50,
                        minWidth: '160px',
                        overflow: 'hidden'
                      }}>
                        <div style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 'bold', color: 'var(--griid-text-secondary)', borderBottom: '1px solid var(--griid-border)' }}>
                          Export As
                        </div>
                        
                        {file.file_type !== 'unknown' ? (
                          formats.map(fmt => (
                            <button
                              key={fmt.id}
                              style={{
                                display: 'block', width: '100%', textAlign: 'left',
                                padding: '8px 12px', fontSize: '12px',
                                background: 'none', border: 'none', color: 'var(--griid-text)',
                                cursor: 'pointer'
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--griid-surface)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              onClick={() => handleFormatClick(file, fmt.id)}
                            >
                              <span style={{ marginRight: '6px' }}>{file.file_type === 'raster' ? '🗺️' : '▦'}</span>
                              {fmt.name}
                            </button>
                          ))
                        ) : (
                          <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--griid-text-secondary)' }}>
                            Format unexportable
                          </div>
                        )}

                        <div style={{ height: '1px', background: 'var(--griid-border)', margin: '4px 0' }} />
                        
                        <button
                          style={{
                            display: 'flex', width: '100%', alignItems: 'center',
                            padding: '8px 12px', fontSize: '12px',
                            background: 'none', border: 'none', color: '#ef4444',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#ef444415'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          onClick={() => {
                            handleDelete(file.filename);
                            setMenuOpenForId(null);
                          }}
                        >
                          <Trash2 size={14} style={{ marginRight: '6px' }} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>

                  {/* CRS Picker Panel (appears below the file row) */}
                  {isCrsPickerOpen && (
                    <div className="crs-inline-picker">
                      <div className="crs-inline-header">
                        <span className="crs-inline-title">🔄 Reproject CRS? (Optional)</span>
                      </div>
                      <input
                        type="text"
                        className="crs-search"
                        placeholder="Search CRS..."
                        value={crsSearch}
                        onChange={(e) => setCrsSearch(e.target.value)}
                        autoFocus
                      />
                      <div className="crs-list" style={{ maxHeight: '150px' }}>
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
                      <div className="crs-inline-actions">
                        <button
                          className="crs-skip-btn"
                          onClick={() => handleExportWithoutCrs(file)}
                        >
                          Skip (Keep Original)
                        </button>
                        <button
                          className="crs-apply-btn"
                          disabled={!selectedCrs}
                          onClick={() => handleExportWithCrs(file)}
                        >
                          {selectedCrs ? `Export → EPSG:${selectedCrs}` : 'Select CRS'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>

      </div>
    </div>
  );
}
