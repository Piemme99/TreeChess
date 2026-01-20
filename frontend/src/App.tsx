import { useEffect, useState, useCallback } from 'react';
import { ChessBoard } from './components/ChessBoard';
import { RepertoireTreeView } from './components/RepertoireTree';
import { useRepertoireStore } from './stores/repertoireStore';
import { repertoireApi, importApi } from './services/api';
import { Color, RepertoireNode } from './types';
import { getLegalMoves } from './utils/chess';

function App() {
  const {
    whiteRepertoire,
    blackRepertoire,
    selectedNodeId,
    loading,
    error,
    setRepertoire,
    selectNode,
    addMove,
    setLoading,
    setError
  } = useRepertoireStore();

  const [viewColor, setViewColor] = useState<Color>('w');
  const [pgnInput, setPgnInput] = useState('');
  const [importStatus, setImportStatus] = useState('');

  const loadRepertoires = useCallback(async () => {
    setLoading(true);
    try {
      const [white, black] = await Promise.all([
        repertoireApi.get('w'),
        repertoireApi.get('b')
      ]);
      setRepertoire('w', white);
      setRepertoire('b', black);
    } catch {
      setError({ message: 'Failed to load repertoires' });
    } finally {
      setLoading(false);
    }
  }, [setRepertoire, setLoading, setError]);

  useEffect(() => {
    loadRepertoires();
  }, [loadRepertoires]);

  const handleMove = (san: string) => {
    const currentRepertoire = viewColor === 'w' ? whiteRepertoire : blackRepertoire;
    if (!currentRepertoire || !selectedNodeId) return;

    const currentNode = findNode(currentRepertoire.root, selectedNodeId);
    if (!currentNode) return;

    const success = addMove(viewColor, selectedNodeId, san, currentNode.fen);

    if (success) {
      selectNode(crypto.randomUUID());
    }
  };

  const handleNodeSelect = (nodeId: string) => {
    selectNode(nodeId);
  };

  const findNode = (node: RepertoireNode | null, id: string): RepertoireNode | null => {
    if (!node) return null;
    if (node.id === id) return node;
    for (const child of node.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
    return null;
  };

  const handleImport = async () => {
    if (!pgnInput.trim()) return;

    setImportStatus('Importing...');
    setLoading(true);

    try {
      await importApi.upload(pgnInput);
      setImportStatus('Import successful!');
      setPgnInput('');
      await loadRepertoires();
    } catch {
      setImportStatus('Import failed');
    } finally {
      setLoading(false);
      setTimeout(() => setImportStatus(''), 3000);
    }
  };

  const currentRepertoire = viewColor === 'w' ? whiteRepertoire : blackRepertoire;
  const selectedNode = selectedNodeId && currentRepertoire
    ? findNode(currentRepertoire.root, selectedNodeId)
    : null;

  const currentFEN = selectedNode?.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const possibleMoves = selectedNode && selectedNode.children.length > 0
    ? selectedNode.children.map((c: RepertoireNode) => c.move || '')
    : selectedNode
    ? getLegalMoves(selectedNode.fen).map(m => m.san)
    : [];

  if (loading && !currentRepertoire) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: '20px', color: 'red' }}>{error.message}</div>;
  }

  return (
    <div style={{ display: 'flex', gap: '20px', padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div>
        <h2>Chess Board</h2>
        <ChessBoard
          fen={currentFEN}
          onMove={handleMove}
          onSquareClick={handleNodeSelect}
          orientation={viewColor === 'w' ? 'white' : 'black'}
          selectedSquare={selectedNodeId || undefined}
          possibleMoves={possibleMoves}
        />
        <div style={{ marginTop: '10px' }}>
          <label>
            <input
              type="radio"
              checked={viewColor === 'w'}
              onChange={() => setViewColor('w')}
            />
            White Repertoire
          </label>
          <label style={{ marginLeft: '10px' }}>
            <input
              type="radio"
              checked={viewColor === 'b'}
              onChange={() => setViewColor('b')}
            />
            Black Repertoire
          </label>
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <h2>Repertoire Tree ({viewColor === 'w' ? 'White' : 'Black'})</h2>
        {currentRepertoire && currentRepertoire.root ? (
          <RepertoireTreeView
            repertoire={currentRepertoire.root}
            selectedNodeId={selectedNodeId}
            onSelectNode={handleNodeSelect}
            color={viewColor}
          />
        ) : (
          <p>No repertoire loaded</p>
        )}

        <div style={{ marginTop: '20px', borderTop: '1px solid #ccc', paddingTop: '20px' }}>
          <h3>Import PGN</h3>
          <textarea
            value={pgnInput}
            onChange={e => setPgnInput(e.target.value)}
            placeholder="Paste PGN here..."
            rows={6}
            style={{ width: '100%', marginBottom: '10px' }}
          />
          <button onClick={handleImport} disabled={loading || !pgnInput.trim()}>
            Import
          </button>
          {importStatus && <span style={{ marginLeft: '10px' }}>{importStatus}</span>}
        </div>
      </div>
    </div>
  );
}

export default App;
