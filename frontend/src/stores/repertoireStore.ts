import { create } from 'zustand';
import { Repertoire, RepertoireNode, Color, ApiError } from '../types';
import { makeMove, getShortFEN } from '../utils/chess';

interface RepertoireState {
  whiteRepertoire: Repertoire | null;
  blackRepertoire: Repertoire | null;
  selectedNodeId: string | null;
  loading: boolean;
  error: ApiError | null;

  setRepertoire: (color: Color, repertoire: Repertoire) => void;
  selectNode: (nodeId: string | null) => void;
  addMove: (color: Color, parentId: string, san: string, fenBefore: string) => boolean;
  deleteNode: (color: Color, nodeId: string) => boolean;
  setLoading: (loading: boolean) => void;
  setError: (error: ApiError | null) => void;

  getSelectedNode: (color: Color) => RepertoireNode | null;
  getRootPosition: (color: Color) => string;
  getPossibleMoves: (color: Color, nodeId: string) => string[];
}

function findNode(node: RepertoireNode, id: string): RepertoireNode | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function findParent(node: RepertoireNode, id: string): { parent: RepertoireNode; childIndex: number } | null {
  for (let i = 0; i < node.children.length; i++) {
    if (node.children[i].id === id) {
      return { parent: node, childIndex: i };
    }
    const found = findParent(node.children[i], id);
    if (found) return found;
  }
  return null;
}

export const useRepertoireStore = create<RepertoireState>((set, get) => ({
  whiteRepertoire: null,
  blackRepertoire: null,
  selectedNodeId: null,
  loading: false,
  error: null,

  setRepertoire: (color, repertoire) => {
    if (color === 'w') {
      set({ whiteRepertoire: repertoire });
    } else {
      set({ blackRepertoire: repertoire });
    }
  },

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  addMove: (color, parentId, san, fenBefore) => {
    const repertoire = color === 'w' ? get().whiteRepertoire : get().blackRepertoire;
    if (!repertoire) return false;

    const fenAfter = makeMove(fenBefore, san);
    if (!fenAfter) return false;

    const parentNode = findNode(repertoire.root, parentId);
    if (!parentNode) return false;

    const moveNumber = parentNode.moveNumber + (parentNode.colorToMove === 'w' ? 0 : 1);
    const newChild: RepertoireNode = {
      id: crypto.randomUUID(),
      fen: getShortFEN(fenAfter),
      move: san,
      moveNumber,
      colorToMove: parentNode.colorToMove === 'w' ? 'b' : 'w',
      parentId,
      children: []
    };

    parentNode.children.push(newChild);

    if (color === 'w') {
      set({ whiteRepertoire: { ...repertoire } });
    } else {
      set({ blackRepertoire: { ...repertoire } });
    }

    return true;
  },

  deleteNode: (color, nodeId) => {
    const repertoire = color === 'w' ? get().whiteRepertoire : get().blackRepertoire;
    if (!repertoire) return false;

    if (repertoire.root.id === nodeId) return false;

    const result = findParent(repertoire.root, nodeId);
    if (!result) return false;

    result.parent.children.splice(result.childIndex, 1);

    if (color === 'w') {
      set({ whiteRepertoire: { ...repertoire } });
    } else {
      set({ blackRepertoire: { ...repertoire } });
    }

    return true;
  },

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  getSelectedNode: (color) => {
    const repertoire = color === 'w' ? get().whiteRepertoire : get().blackRepertoire;
    const selectedId = get().selectedNodeId;
    if (!repertoire || !selectedId) return null;
    return findNode(repertoire.root, selectedId);
  },

  getRootPosition: (color) => {
    const repertoire = color === 'w' ? get().whiteRepertoire : get().blackRepertoire;
    return repertoire?.root.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  },

  getPossibleMoves: (color, nodeId) => {
    const repertoire = color === 'w' ? get().whiteRepertoire : get().blackRepertoire;
    if (!repertoire) return [];

    const node = findNode(repertoire.root, nodeId);
    if (!node) return [];

    return node.children.map((child: RepertoireNode) => child.move || '');
  }
}));
