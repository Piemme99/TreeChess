import { useEffect, useRef, useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useParams, useNavigate, useLocation } from 'react-router';
import { useRepertoireStore, useRepertoireById } from '../../../../stores/repertoireStore';
import { exploreApi } from '../../../../services/api';
import { toast } from '../../../../stores/toastStore';
import type { Repertoire } from '../../../../types';

export function useRepertoireLoader() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isExploreRoute = location.pathname.startsWith('/explore/');

  // --- Read-only mode (explore) ---
  const [exploreRepertoire, setExploreRepertoire] = useState<Repertoire | null>(null);
  const [exploreLoading, setExploreLoading] = useState(false);
  const [exploreSelectedNodeId, setExploreSelectedNodeId] = useState<string | null>(null);
  const exploreInitializedRef = useRef(false);

  useEffect(() => {
    if (!isExploreRoute || !id) return;
    let cancelled = false;
    setExploreLoading(true);
    exploreInitializedRef.current = false;

    exploreApi.getPublic(id)
      .then((data) => {
        if (cancelled) return;
        setExploreRepertoire(data);
        setExploreSelectedNodeId(data.treeData.id);
        exploreInitializedRef.current = true;
      })
      .catch(() => {
        if (cancelled) return;
        toast.error('Repertoire not found');
        navigate('/explore');
      })
      .finally(() => {
        if (!cancelled) setExploreLoading(false);
      });

    return () => { cancelled = true; };
  }, [id, isExploreRoute, navigate]);

  const exploreSelectNode = useCallback((nodeId: string | null) => {
    setExploreSelectedNodeId(nodeId);
  }, []);

  // --- Normal edit mode ---
  const {
    selectedRepertoireId,
    selectedNodeId,
    loading,
    fetchRepertoire,
    selectRepertoire,
    selectNode,
    updateRepertoire,
    setLoading
  } = useRepertoireStore(
    useShallow((s) => ({
      selectedRepertoireId: s.selectedRepertoireId,
      selectedNodeId: s.selectedNodeId,
      loading: s.loading,
      fetchRepertoire: s.fetchRepertoire,
      selectRepertoire: s.selectRepertoire,
      selectNode: s.selectNode,
      updateRepertoire: s.updateRepertoire,
      setLoading: s.setLoading,
    }))
  );

  const repertoire = useRepertoireById(id || null);
  const initializedRef = useRef(false);

  // Effect to select the repertoire when ID changes (edit mode only)
  useEffect(() => {
    if (isExploreRoute) return;
    if (!id) {
      navigate('/');
      return;
    }

    // Only select repertoire if it's different from current
    if (selectedRepertoireId !== id) {
      selectRepertoire(id);
      initializedRef.current = false;
    }
  }, [id, selectedRepertoireId, selectRepertoire, navigate, isExploreRoute]);

  // Effect to load repertoire data and select initial node (edit mode only)
  useEffect(() => {
    if (isExploreRoute) return;
    let cancelled = false;

    const loadRepertoire = async () => {
      if (!id || initializedRef.current) return;

      if (!repertoire) {
        setLoading(true);
        try {
          const data = await fetchRepertoire(id);
          if (cancelled) return;
          if (data) {
            selectNode(data.treeData.id);
            initializedRef.current = true;
          } else {
            toast.error('Repertoire not found');
            navigate('/');
          }
        } catch {
          if (cancelled) return;
          toast.error('Failed to load repertoire');
          navigate('/');
        } finally {
          if (!cancelled) setLoading(false);
        }
      } else if (!selectedNodeId) {
        selectNode(repertoire.treeData.id);
        initializedRef.current = true;
      } else {
        initializedRef.current = true;
      }
    };

    loadRepertoire();
    return () => { cancelled = true; };
  }, [id, repertoire, selectedNodeId, fetchRepertoire, selectNode, setLoading, navigate, isExploreRoute]);

  // Fallback: ensure root node is always selected when repertoire is loaded (edit mode only)
  useEffect(() => {
    if (isExploreRoute) return;
    if (repertoire && !selectedNodeId && !loading) {
      selectNode(repertoire.treeData.id);
    }
  }, [repertoire, selectedNodeId, loading, selectNode, isExploreRoute]);

  if (isExploreRoute) {
    return {
      id,
      color: exploreRepertoire?.color,
      repertoire: exploreRepertoire,
      selectedNodeId: exploreSelectedNodeId,
      loading: exploreLoading,
      selectNode: exploreSelectNode,
      setRepertoire: setExploreRepertoire as (r: Repertoire) => void,
      setLoading: setExploreLoading,
      readOnly: true as const
    };
  }

  return {
    id,
    color: repertoire?.color,
    repertoire,
    selectedNodeId,
    loading,
    selectNode,
    setRepertoire: updateRepertoire,
    setLoading,
    readOnly: false as const
  };
}
