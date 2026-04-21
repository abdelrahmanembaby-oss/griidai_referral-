/**
 * useExport – React hook for export workflow
 *
 * Usage:
 *   const { startExport, status, progress, downloadUrl, error, isExporting } = useExport();
 *   startExport({ file_id: '...', target_format: 'geojson' });
 */
import { useState, useRef, useCallback } from 'react';
import {
  requestExport,
  uploadAndExport,
  getExportStatus,
  getExportDownloadUrl,
} from '@/api/exportApi';
import type { ExportRequest, ExportStatus } from '@/types/export';

const POLL_INTERVAL_MS = 1500;

interface UseExportReturn {
  startExport: (req: ExportRequest) => Promise<void>;
  startUploadExport: (file: File, targetFormat: string) => Promise<void>;
  status: ExportStatus | null;
  progress: number;
  message: string;
  downloadUrl: string | null;
  error: string | null;
  isExporting: boolean;
  reset: () => void;
}

export function useExport(): UseExportReturn {
  const [status, setStatus] = useState<ExportStatus | null>(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stopPolling();
    setStatus(null);
    setProgress(0);
    setMessage('');
    setDownloadUrl(null);
    setError(null);
    setIsExporting(false);
  }, [stopPolling]);

  const startExport = useCallback(
    async (req: ExportRequest) => {
      reset();
      setIsExporting(true);
      setStatus('PENDING');
      setMessage('Submitting export request...');

      try {
        const accepted = await requestExport(req);
        const taskId = accepted.task_id;
        setMessage('Export queued, starting...');

        // Start polling
        pollingRef.current = setInterval(async () => {
          try {
            const result = await getExportStatus(taskId);
            setStatus(result.status);
            setProgress(result.progress);
            setMessage(result.message);

            if (result.status === 'SUCCESS') {
              stopPolling();
              setDownloadUrl(getExportDownloadUrl(taskId));
              setIsExporting(false);
            } else if (result.status === 'FAILURE') {
              stopPolling();
              setError(result.message || 'Export failed');
              setIsExporting(false);
            }
          } catch (pollErr: any) {
            stopPolling();
            setError(pollErr.message || 'Failed to check export status');
            setIsExporting(false);
          }
        }, POLL_INTERVAL_MS);
      } catch (err: any) {
        setError(err.message || 'Failed to start export');
        setIsExporting(false);
        setStatus('FAILURE');
      }
    },
    [reset, stopPolling]
  );

  const startUploadExport = useCallback(
    async (file: File, targetFormat: string) => {
      reset();
      setIsExporting(true);
      setStatus('PENDING');
      setMessage('Uploading file...');

      try {
        const accepted = await uploadAndExport(file, targetFormat);
        const taskId = accepted.task_id;
        setMessage('Export queued, starting...');

        // Start polling
        pollingRef.current = setInterval(async () => {
          try {
            const result = await getExportStatus(taskId);
            setStatus(result.status);
            setProgress(result.progress);
            setMessage(result.message);

            if (result.status === 'SUCCESS') {
              stopPolling();
              setDownloadUrl(getExportDownloadUrl(taskId));
              setIsExporting(false);
            } else if (result.status === 'FAILURE') {
              stopPolling();
              setError(result.message || 'Export failed');
              setIsExporting(false);
            }
          } catch (pollErr: any) {
            stopPolling();
            setError(pollErr.message || 'Failed to check export status');
            setIsExporting(false);
          }
        }, POLL_INTERVAL_MS);
      } catch (err: any) {
        setError(err.message || 'Failed to upload and start export');
        setIsExporting(false);
        setStatus('FAILURE');
      }
    },
    [reset, stopPolling]
  );

  return {
    startExport,
    startUploadExport,
    status,
    progress,
    message,
    downloadUrl,
    error,
    isExporting,
    reset,
  };
}
