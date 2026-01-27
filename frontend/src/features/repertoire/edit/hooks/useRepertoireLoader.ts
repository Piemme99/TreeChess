import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRepertoireStore, useRepertoireById } from '../../../../stores/repertoireStore';
import { toast } from '../../../../stores/toastStore';

export function useRepertoireLoader() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    selectedRepertoireId,
    selectedNodeId,
    loading,
    fetchRepertoire,
    selectRepertoire,
    selectNode,
    updateRepertoire,
    setLoading
  } = useRepertoireStore();

  const repertoire = useRepertoireById(id || null);
  const initializedRef = useRef(false);

  // Effect to select the repertoire when ID changes
  useEffect(() => {
    if (!id) {
      navigate('/');
      return;
    }

    // Only select repertoire if it's different from current
    if (selectedRepertoireId !== id) {
      selectRepertoire(id);
      initializedRef.current = false;
    }
  }, [id, selectedRepertoireId, selectRepertoire, navigate]);

  // Effect to load repertoire data and select initial node
  useEffect(() => {
    const loadRepertoire = async () => {
      if (!id || initializedRef.current) return;

      if (!repertoire) {
        setLoading(true);
        try {
          const data = await fetchRepertoire(id);
          if (data) {
            selectNode(data.treeData.id);
            initializedRef.current = true;
          } else {
            toast.error('Repertoire not found');
            navigate('/');
          }
        } catch {
          toast.error('Failed to load repertoire');
          navigate('/');
        } finally {
          setLoading(false);
        }
      } else if (!selectedNodeId) {
        selectNode(repertoire.treeData.id);
        initializedRef.current = true;
      } else {
        initializedRef.current = true;
      }
    };

    loadRepertoire();
  }, [id, repertoire, selectedNodeId, fetchRepertoire, selectNode, setLoading, navigate]);

  return {
    id,
    color: repertoire?.color,
    repertoire,
    selectedNodeId,
    loading,
    selectNode,
    setRepertoire: updateRepertoire,
    setLoading
  };
}
