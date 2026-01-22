import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRepertoireStore } from '../../stores/repertoireStore';
import { repertoireApi, importApi } from '../../services/api';
import { toast } from '../../stores/toastStore';
import { Button, Loading, Modal, ConfirmModal } from '../UI';
import type { Color, AnalysisSummary } from '../../types';

interface RepertoireCardProps {
  color: Color;
  totalMoves: number;
  totalNodes: number;
  onEdit: () => void;
}

function RepertoireCard({ color, totalMoves, totalNodes, onEdit }: RepertoireCardProps) {
  const isWhite = color === 'white';

  return (
    <div className={`repertoire-card ${isWhite ? 'repertoire-card-white' : 'repertoire-card-black'}`}>
      <div className="repertoire-card-icon">
        {isWhite ? '♔' : '♚'}
      </div>
      <h3 className="repertoire-card-title">
        {isWhite ? 'White' : 'Black'} Repertoire
      </h3>
      <div className="repertoire-card-stats">
        <div className="stat">
          <span className="stat-value">{totalNodes}</span>
          <span className="stat-label">positions</span>
        </div>
        <div className="stat">
          <span className="stat-value">{totalMoves}</span>
          <span className="stat-label">moves</span>
        </div>
      </div>
      <Button variant="primary" onClick={onEdit}>
        Edit Repertoire
      </Button>
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    whiteRepertoire,
    blackRepertoire,
    loading,
    setRepertoire,
    setLoading,
    setError
  } = useRepertoireStore();

  // Recent imports state
  const [recentImports, setRecentImports] = useState<AnalysisSummary[]>([]);
  const [loadingImports, setLoadingImports] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedColor, setSelectedColor] = useState<Color>('white');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load repertoires
  useEffect(() => {
    const loadRepertoires = async () => {
      setLoading(true);
      try {
        const [white, black] = await Promise.all([
          repertoireApi.get('white'),
          repertoireApi.get('black')
        ]);
        setRepertoire('white', white);
        setRepertoire('black', black);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load repertoires';
        setError({ message });
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    loadRepertoires();
  }, [setRepertoire, setLoading, setError]);

  // Load recent imports
  useEffect(() => {
    const loadImports = async () => {
      try {
        const data = await importApi.list();
        // Show only 5 most recent
        setRecentImports((data || []).slice(0, 5));
      } catch {
        // Silent fail for imports - not critical
      } finally {
        setLoadingImports(false);
      }
    };

    loadImports();
  }, []);

  // File upload handlers
  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pgn')) {
      toast.error('Please select a .pgn file');
      return;
    }

    setUploading(true);
    try {
      const result = await importApi.upload(file, selectedColor);
      toast.success(`Imported ${result.gameCount} game(s)`);
      setShowImportModal(false);
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

  // Delete handler
  const handleDelete = useCallback(async () => {
    if (!deleteId) return;

    setDeleting(true);
    try {
      await importApi.delete(deleteId);
      setRecentImports((prev) => prev.filter((a) => a.id !== deleteId));
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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && !whiteRepertoire && !blackRepertoire) {
    return (
      <div className="dashboard">
        <Loading size="lg" text="Loading repertoires..." />
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1 className="dashboard-title">TreeChess</h1>
        <p className="dashboard-subtitle">Build and manage your chess opening repertoire</p>
      </header>

      <section className="dashboard-section">
        <h2 className="dashboard-section-title">Your repertoires</h2>
        <div className="dashboard-repertoires">
          <RepertoireCard
            color="white"
            totalMoves={whiteRepertoire?.metadata.totalMoves || 0}
            totalNodes={whiteRepertoire?.metadata.totalNodes || 0}
            onEdit={() => navigate('/repertoire/white/edit')}
          />
          <RepertoireCard
            color="black"
            totalMoves={blackRepertoire?.metadata.totalMoves || 0}
            totalNodes={blackRepertoire?.metadata.totalNodes || 0}
            onEdit={() => navigate('/repertoire/black/edit')}
          />
        </div>
      </section>

      <section className="dashboard-section">
        <h2 className="dashboard-section-title">Recent imports</h2>
        {loadingImports ? (
          <Loading size="sm" text="Loading imports..." />
        ) : recentImports.length === 0 ? (
          <p className="dashboard-empty">No imports yet. Import a PGN file to analyze your games.</p>
        ) : (
          <div className="dashboard-imports">
            {recentImports.map((analysis) => (
              <div key={analysis.id} className="import-item">
                <div className="import-item-info">
                  <span className="import-item-icon">
                    {analysis.color === 'white' ? '♔' : '♚'}
                  </span>
                  <div className="import-item-details">
                    <span className="import-item-filename">{analysis.filename}</span>
                    <span className="import-item-meta">
                      {analysis.gameCount} game{analysis.gameCount !== 1 ? 's' : ''} - {formatDate(analysis.uploadedAt)}
                    </span>
                  </div>
                </div>
                <div className="import-item-actions">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setDeleteId(analysis.id)}
                  >
                    Delete
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate(`/import/${analysis.id}`)}
                  >
                    Analyze
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-actions">
        <Button
          variant="secondary"
          size="lg"
          onClick={() => setShowImportModal(true)}
        >
          Import PGN
        </Button>
      </section>

      {/* Import PGN Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => !uploading && setShowImportModal(false)}
        title="Import PGN file"
        size="sm"
      >
        <div className="import-modal-content">
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
                  Choose file or drag and drop
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
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
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
