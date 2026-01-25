import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRepertoireStore } from '../../../../stores/repertoireStore';
import { repertoireApi } from '../../../../services/api';
import { toast } from '../../../../stores/toastStore';
import type { Color } from '../../../../types';

export function useRepertoireLoader() {
  const { color } = useParams<{ color: Color }>();
  const navigate = useNavigate();
  const {
    whiteRepertoire,
    blackRepertoire,
    selectedNodeId,
    loading,
    setRepertoire,
    selectNode,
    setLoading
  } = useRepertoireStore();

  const repertoire = color === 'white' ? whiteRepertoire : blackRepertoire;

  useEffect(() => {
    const loadRepertoire = async () => {
      if (!color || (color !== 'white' && color !== 'black')) {
        navigate('/');
        return;
      }

      if (!repertoire) {
        setLoading(true);
        try {
          const data = await repertoireApi.get(color);
          setRepertoire(color, data);
          selectNode(data.treeData.id);
        } catch {
          toast.error('Failed to load repertoire');
          navigate('/');
        } finally {
          setLoading(false);
        }
      } else if (!selectedNodeId) {
        selectNode(repertoire.treeData.id);
      }
    };

    loadRepertoire();
  }, [color, repertoire, selectedNodeId, setRepertoire, selectNode, setLoading, navigate]);

  return { color, repertoire, selectedNodeId, loading, selectNode, setRepertoire, setLoading };
}