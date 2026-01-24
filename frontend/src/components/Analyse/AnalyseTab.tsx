import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { importApi, usernameStorage } from '../../services/api';
import { toast } from '../../stores/toastStore';
import { Button, ConfirmModal, Loading } from '../UI';
import type { AnalysisSummary } from '../../types';

export function AnalyseTab() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [username, setUsername] = useState(() => usernameStorage.get());
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

    if (!username.trim()) {
      toast.error('Please enter your username first');
      return;
    }

    // Save username to localStorage
    usernameStorage.set(username.trim());

    setUploading(true);
    try {
      const result = await importApi.upload(file, username.trim());
      toast.success(`Imported ${result.gameCount} game(s)`);
      navigate(`/analyse/${result.id}`);
    } catch {
      toast.error('Failed to upload PGN file');
    } finally {
      setUploading(false);
    }
  }, [username, navigate]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
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
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="analyse-tab">
      <section className="import-section">
        <h2>Import games</h2>
        <div className="username-input">
          <label htmlFor="username">Your username:</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your Lichess or Chess.com username"
          />
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

      <section className="analyses-section">
        <h2>Recent analyses</h2>
        {loading ? (
          <Loading text="Loading analyses..." />
        ) : analyses.length === 0 ? (
          <p className="no-analyses">No analyses yet. Upload a PGN file to get started.</p>
        ) : (
          <div className="analyses-list">
            {analyses.map((analysis) => (
              <div key={analysis.id} className="analysis-card">
                <div className="analysis-info">
                  <div className="analysis-details">
                    <h3 className="analysis-filename">{analysis.filename}</h3>
                    <p className="analysis-meta">
                      {analysis.username} &middot;{' '}
                      {analysis.gameCount} game{analysis.gameCount !== 1 ? 's' : ''} &middot;{' '}
                      {formatDate(analysis.uploadedAt)}
                    </p>
                  </div>
                </div>
                <div className="analysis-actions">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate(`/analyse/${analysis.id}`)}
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
