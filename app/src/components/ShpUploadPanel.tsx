import { useState, useRef, useEffect } from 'react';
import { Upload, X, Loader2, Map as MapIcon, Database } from 'lucide-react';
import type { VectorLayer } from './MapPanel';

interface ShpUploadPanelProps {
  onLayerLoaded: (layer: VectorLayer) => void;
  onLayerRemoved: (layerId: string) => void;
  activeLayers: VectorLayer[];
}

interface UploadingJob {
  id: string; // the upload id (local or backend)
  name: string;
  status: 'processing' | 'succeeded' | 'failed';
  progress?: number;
  message?: string;
  files: File[];
  jobId?: string; // from backend
}

export function ShpUploadPanel({ onLayerLoaded, onLayerRemoved, activeLayers }: ShpUploadPanelProps) {
  const [jobs, setJobs] = useState<UploadingJob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Poll backend for job status
  useEffect(() => {
    const interval = setInterval(() => {
      setJobs(currentJobs => {
        let changed = false;
        const newJobs = [...currentJobs];
        
        newJobs.forEach((job) => {
          if (job.status === 'processing' && job.jobId) {
            // we should not await inside normal map without Promise.all, so we do unhandled fetch
            fetch(`http://localhost:8000/api/v1/vector-layers/${job.jobId}/status`)
              .then(res => res.json())
              .then(data => {
                if (data.status !== job.status) {
                    if (data.status === 'SUCCEEDED') {
                        // get Signed URL
                        fetch(`http://localhost:8000/api/v1/vector-layers/${job.jobId}/pmtiles-url`)
                            .then(res => res.json())
                            .then(urlData => {
                                onLayerLoaded({
                                    id: job.jobId!,
                                    name: data.layer_name,
                                    url: urlData.url
                                });
                                // remove from jobs to show in loaded layers
                                setJobs(prev => prev.filter(j => j.id !== job.id));
                            });
                    } else if (data.status === 'FAILED') {
                        setJobs(prev => {
                           const cp = [...prev];
                           const i = cp.findIndex(j => j.id === job.id);
                           if (i >= 0) {
                               cp[i] = { ...cp[i], status: 'failed', message: data.message };
                           }
                           return cp;
                        });
                    }
                }
              })
              .catch(console.error);
          }
        });
        
        return changed ? newJobs : currentJobs;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [onLayerLoaded]);


  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    // Convert FileList to Array
    const files = Array.from(e.target.files);
    
    // Check if we have a .shp file
    const hasShp = files.some(f => f.name.toLowerCase().endsWith('.shp'));
    if (!hasShp) {
        alert("You must include at least the .shp file.");
        return;
    }

    const name = files.find(f => f.name.toLowerCase().endsWith('.shp'))!.name.split('.')[0];
    const uuid = Math.random().toString(36).substring(7);
    
    const newJob: UploadingJob = {
        id: uuid,
        name: name,
        status: 'processing',
        files: files
    };
    
    setJobs(prev => [newJob, ...prev]);

    // Send to backend
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));

    try {
        const response = await fetch('http://localhost:8000/api/v1/vector-layers/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Upload failed with status ${response.status}`);
        }

        const data = await response.json();
        
        // update job with jobId from backend
        setJobs(prev => {
            const cp = [...prev];
            const i = cp.findIndex(j => j.id === uuid);
            if (i >= 0) cp[i] = { ...cp[i], jobId: data.job_id };
            return cp;
        });

    } catch (err: any) {
        setJobs(prev => {
            const cp = [...prev];
            const i = cp.findIndex(j => j.id === uuid);
            if (i >= 0) cp[i] = { ...cp[i], status: 'failed', message: err.message };
            return cp;
        });
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="shp-upload-panel">
        <h3 className="shp-upload-title">Vector Layers</h3>
        
        {/* Upload Zone */}
        <div 
            className="shp-drop-zone"
            onClick={() => fileInputRef.current?.click()}
        >
            <Upload size={24} color="var(--griid-teal)" />
            <span className="shp-drop-text">Click to upload SHP files</span>
            <span className="shp-drop-subtext">Must include .shp, .dbf, .shx (multi-select)</span>
        </div>
        <input 
            type="file" 
            multiple 
            accept=".shp,.dbf,.shx,.prj,.cpg" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            style={{ display: 'none' }} 
        />

        {/* Processing Jobs */}
        {jobs.length > 0 && (
            <div className="shp-jobs">
                <h4 className="shp-section-title">Processing</h4>
                {jobs.map(job => (
                    <div key={job.id} className="shp-job-card">
                        <div className="shp-job-info">
                            <Database size={16} color="var(--griid-gray-500)" />
                            <span className="shp-job-name">{job.name}</span>
                        </div>
                        {job.status === 'processing' && <Loader2 size={16} className="shp-spin" />}
                        {job.status === 'failed' && <X size={16} color="red" />}
                        {job.message && <div style={{color:'red', fontSize: '10px'}}>{job.message}</div>}
                    </div>
                ))}
            </div>
        )}

        {/* Loaded Layers */}
        <div className="shp-layers">
            <h4 className="shp-section-title">Loaded on Map</h4>
            {activeLayers.length === 0 ? (
                <div className="shp-empty">No layers added yet.</div>
            ) : (
                activeLayers.map(layer => (
                    <div key={layer.id} className="shp-layer-card">
                         <div className="shp-layer-info">
                            <MapIcon size={16} color="white" fill="var(--griid-teal)" />
                            <span className="shp-layer-name">{layer.name}</span>
                        </div>
                        <button className="shp-layer-remove" onClick={() => onLayerRemoved(layer.id)}>
                            <X size={14} />
                        </button>
                    </div>
                ))
            )}
        </div>
    </div>
  );
}
