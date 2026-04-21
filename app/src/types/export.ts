/**
 * Export feature – TypeScript types
 */

export type ExportFormat = 'geojson' | 'shapefile' | 'kml' | 'geotiff' | 'png' | 'jpeg';

export type ExportStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILURE';

export interface ExportRequest {
  file_id: string;
  target_format: ExportFormat;
  source_url?: string;
  provider?: string;
  target_crs?: number;
}

export interface ExportAccepted {
  task_id: string;
  status: string;
  message: string;
}

export interface ExportStatusResponse {
  task_id: string;
  status: ExportStatus;
  progress: number;
  message: string;
  download_url: string | null;
  created_at: string | null;
  format: string | null;
}

export interface FormatOption {
  id: ExportFormat;
  name: string;
  extension: string;
  description: string;
}

export interface FormatGroups {
  vector: FormatOption[];
  raster: FormatOption[];
}
