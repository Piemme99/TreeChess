import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usernameStorage } from '../../services/api';
import { useAnalyses } from './hooks/useAnalyses';
import { useFileUpload } from './hooks/useFileUpload';
import { useDeleteAnalysis } from './hooks/useDeleteAnalysis';
import { ImportSection } from './components/ImportSection';
import { AnalysesList } from './components/AnalysesList';
import { ConfirmModal } from '../../components/UI';

export function AnalyseTab() {
  const navigate = useNavigate();
  const [username, setUsername] = useState(() => usernameStorage.get());

  const { analyses, loading, deleteAnalysis } = useAnalyses();
  const fileUploadState = useFileUpload(username);
  const { deleteId, setDeleteId, deleting, handleDelete } = useDeleteAnalysis(deleteAnalysis);

  const handleViewClick = useCallback((id: string) => {
    navigate(`/analyse/${id}`);
  }, [navigate]);

  return (
    <div className="analyse-tab">
      <ImportSection
        username={username}
        onUsernameChange={setUsername}
        fileUploadState={fileUploadState}
      />

      <section className="analyses-section">
        <h2>Recent analyses</h2>
        <AnalysesList
          analyses={analyses}
          loading={loading}
          onDeleteClick={setDeleteId}
          onViewClick={handleViewClick}
        />
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