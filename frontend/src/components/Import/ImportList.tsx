import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { importApi } from '../../services/api';
import { toast } from '../../stores/toastStore';
import { Button, ConfirmModal, Loading } from '../UI';
import type { AnalysisSummary, Color } from '../../types';

export function ImportList() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedColor, setSelectedColor] = useState<Color>('white');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const loadAnalyses = useCallback(async () => {
    try {
      const data = await importApi.list();
      setAnalyses(data || []);
    } catch {
      toast.error('Failed to load analyses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalyses();
  }, [loadAnalyses]);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pgn')) {
      toast.error('Please select a .pgn file');
      return;
    }

    setUploading(true);
    try {
      const result = await importApi.upload(file, selectedColor);
      toast.success(`Imported ${result.gameCount} game(s)`);
      navigate(`/import/${result.id}`);
    } catch {
      toast.error('Failed to upload PGN file');
    } finally {
      setUploading(false);
    }
  }, [selectedColor, navigate]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFileUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteId) return;

    setDeleting(true);
    try {
      await importApi.delete(deleteId);
      setAnalyses((prev) => prev.filter((a) => a.id !== deleteId));
      toast.success('Analysis deleted');
      setDeleteId(null);
    } catch {
      toast.error('Failed to delete analysis');
    } finally {
      setDeleting(false);
    }
  }, [deleteId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="import-list">
      <header className="import-list-header">
        <Button variant="ghost" onClick={() => navigate('/')}>
          &larr; Back
        </Button>
        <h1>Import PGN</h1>
        <div className="header-spacer" />
      </header>

      <section className="import-upload-section">
        <div className="color-selector">
          <label>Analyze against:</label>
          <div className="color-buttons">
            <button
              className={`color-btn ${selectedColor === 'white' ? 'active' : ''}`}
              onClick={() => setSelectedColor('white')}
            >
              <span className="color-icon">♔</span> White
            </button>
            <button
              className={`color-btn ${selectedColor === 'black' ? 'active' : ''}`}
              onClick={() => setSelectedColor('black')}
            >
              <span className="color-icon">♚</span> Black
            </button>
          </div>
        </div>

        <div
          className={`drop-zone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          {uploading ? (
            <Loading text="Uploading and analyzing..." />
          ) : (
            <>
              <div className="drop-zone-icon">📁</div>
              <p className="drop-zone-text">
                Drag & drop a PGN file here, or click to select
              </p>
              <p className="drop-zone-hint">.pgn files only</p>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pgn"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </section>

      <section className="import-history-section">
        <h2>Previous Analyses</h2>
        {loading ? (
          <Loading text="Loading analyses..." />
        ) : analyses.length === 0 ? (
          <p className="no-analyses">No analyses yet. Upload a PGN file to get started.</p>
        ) : (
          <div className="analyses-list">
            {analyses.map((analysis) => (
              <div key={analysis.id} className="analysis-card">
                <div className="analysis-info">
                  <span className="analysis-color">
                    {analysis.color === 'white' ? '♔' : '♚'}
                  </span>
                  <div className="analysis-details">
                    <h3 className="analysis-filename">{analysis.filename}</h3>
                    <p className="analysis-meta">
                      {analysis.gameCount} game{analysis.gameCount !== 1 ? 's' : ''} &middot;{' '}
                      {formatDate(analysis.uploadedAt)}
                    </p>
                  </div>
                </div>
                <div className="analysis-actions">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate(`/import/${analysis.id}`)}
                  >
                    View
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setDeleteId(analysis.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Analysis"
        message="Are you sure you want to delete this analysis? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
