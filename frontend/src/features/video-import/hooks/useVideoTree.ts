import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { videoApi } from '../../../services/api';
import type { RepertoireNode, VideoImport, Color } from '../../../types';

export function useVideoTree() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [videoImport, setVideoImport] = useState<VideoImport | null>(null);
  const [treeData, setTreeData] = useState<RepertoireNode | null>(null);
  const [color, setColor] = useState<Color>('white');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        const [vi, treeResponse] = await Promise.all([
          videoApi.get(id!),
          videoApi.getTree(id!),
        ]);

        if (cancelled) return;

        setVideoImport(vi);
        setTreeData(treeResponse.treeData);
        setColor(treeResponse.color);
        setSelectedNodeId(treeResponse.treeData.id);
      } catch (err) {
        if (!cancelled) {
          const axiosError = err as { response?: { data?: { error?: string } } };
          setError(axiosError.response?.data?.error || 'Failed to load video import data');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, [id]);

  const selectNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);

  return {
    id,
    loading,
    videoImport,
    treeData,
    color,
    setColor,
    selectedNodeId,
    selectNode,
    error,
  };
}
