import { useState, useCallback, useEffect, useRef } from 'react';
import { repertoireApi } from '../../../../services/api';
import { toast } from '../../../../stores/toastStore';
import type { Repertoire, RepertoireNode } from '../../../../types';

interface UseNodeAnnotationResult {
  commentText: string;
  branchNameText: string;
  branchColorValue: string | null;
  handleCommentChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleCommentBlur: () => void;
  handleBranchNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBranchNameBlur: () => void;
  handleBranchColorChange: (hex: string | null) => void;
}

/**
 * Manages comment text, branch name, and branch color editing for a selected
 * repertoire node. Auto-saves with debounce (800ms) and immediate save on blur.
 */
export function useNodeAnnotation(
  repertoireId: string | undefined,
  selectedNodeId: string | null,
  selectedNode: RepertoireNode | null,
  setRepertoire: (r: Repertoire) => void,
): UseNodeAnnotationResult {
  const [commentText, setCommentText] = useState('');
  const [branchNameText, setBranchNameText] = useState('');
  const [branchColorValue, setBranchColorValue] = useState<string | null>(null);
  const commentSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const branchNameSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from selected node when it changes
  useEffect(() => {
    setCommentText(selectedNode?.comment || '');
    setBranchNameText(selectedNode?.branchName || '');
    setBranchColorValue(selectedNode?.branchColor || null);
  }, [selectedNodeId, selectedNode?.comment, selectedNode?.branchName, selectedNode?.branchColor]);

  const saveComment = useCallback((text: string) => {
    if (!repertoireId || !selectedNodeId) return;
    const currentComment = selectedNode?.comment || '';
    if (text === currentComment) return;

    repertoireApi.updateNodeComment(repertoireId, selectedNodeId, text)
      .then((updated) => setRepertoire(updated))
      .catch(() => toast.error('Failed to save note'));
  }, [repertoireId, selectedNodeId, selectedNode?.comment, setRepertoire]);

  const handleCommentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setCommentText(text);
    if (commentSaveTimer.current) clearTimeout(commentSaveTimer.current);
    commentSaveTimer.current = setTimeout(() => saveComment(text), 800);
  }, [saveComment]);

  const handleCommentBlur = useCallback(() => {
    if (commentSaveTimer.current) {
      clearTimeout(commentSaveTimer.current);
      commentSaveTimer.current = null;
    }
    saveComment(commentText);
  }, [saveComment, commentText]);

  const saveBranchName = useCallback((text: string) => {
    if (!repertoireId || !selectedNodeId) return;
    const currentBranchName = selectedNode?.branchName || '';
    if (text === currentBranchName) return;

    repertoireApi.updateNodeBranchName(repertoireId, selectedNodeId, text)
      .then((updated) => setRepertoire(updated))
      .catch(() => toast.error('Failed to save branch name'));
  }, [repertoireId, selectedNodeId, selectedNode?.branchName, setRepertoire]);

  const handleBranchNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setBranchNameText(text);
    if (branchNameSaveTimer.current) clearTimeout(branchNameSaveTimer.current);
    branchNameSaveTimer.current = setTimeout(() => saveBranchName(text), 800);
  }, [saveBranchName]);

  const handleBranchNameBlur = useCallback(() => {
    if (branchNameSaveTimer.current) {
      clearTimeout(branchNameSaveTimer.current);
      branchNameSaveTimer.current = null;
    }
    saveBranchName(branchNameText);
  }, [saveBranchName, branchNameText]);

  const handleBranchColorChange = useCallback((hex: string | null) => {
    if (!repertoireId || !selectedNodeId) return;
    setBranchColorValue(hex);
    repertoireApi.updateNodeBranchColor(repertoireId, selectedNodeId, hex || '')
      .then((updated) => setRepertoire(updated))
      .catch(() => toast.error('Failed to save branch color'));
  }, [repertoireId, selectedNodeId, setRepertoire]);

  return {
    commentText,
    branchNameText,
    branchColorValue,
    handleCommentChange,
    handleCommentBlur,
    handleBranchNameChange,
    handleBranchNameBlur,
    handleBranchColorChange,
  };
}
