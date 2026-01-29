import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Loading } from '../../shared/components/UI';
import { ChessBoard } from '../../shared/components/Board/ChessBoard';
import { RepertoireTree } from '../repertoire/shared/components/RepertoireTree';
import { SaveOptions } from './components/SaveOptions';
import { useVideoTree } from './hooks/useVideoTree';
import { findNode } from '../repertoire/edit/utils/nodeUtils';
import { STARTING_FEN } from '../../shared/utils/chess';
import type { RepertoireNode } from '../../types';

export function VideoRepertoirePreview() {
  const navigate = useNavigate();
  const {
    id,
    loading,
    videoImport,
    treeData,
    color,
    setColor,
    selectedNodeId,
    selectNode,
    error,
  } = useVideoTree();

  const selectedNode = treeData && selectedNodeId ? findNode(treeData, selectedNodeId) : null;
  const currentFEN = selectedNode?.fen || STARTING_FEN;

  const handleNodeClick = useCallback(
    (node: RepertoireNode) => {
      selectNode(node.id);
    },
    [selectNode]
  );

  // Find the timestamp for the selected node by looking for a matching position
  const getTimestamp = (): number => {
    if (!selectedNode) return 0;
    // The node FEN contains the position, we approximate the timestamp from the frame index
    // For now, return 0 - the actual timestamp would require mapping from video positions
    return 0;
  };

  if (loading) {
    return (
      <div className="video-preview-page">
        <Loading size="lg" text="Loading video import..." />
      </div>
    );
  }

  if (error || !treeData || !videoImport || !id) {
    return (
      <div className="video-preview-page">
        <h1>Video Import Preview</h1>
        <p className="youtube-error">{error || 'Video import not found'}</p>
        <Button variant="ghost" onClick={() => navigate('/')}>
          &larr; Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="video-preview-page">
      <header className="repertoire-edit-header">
        <Button variant="ghost" onClick={() => navigate('/')}>
          &larr; Back
        </Button>
        <h1 className="repertoire-edit-title">
          {videoImport.title || 'Video Import Preview'}
        </h1>
        <div className="header-spacer" />
      </header>

      <div className="video-preview-content">
        <div className="video-preview-tree">
          <RepertoireTree
            repertoire={treeData}
            selectedNodeId={selectedNodeId}
            onNodeClick={handleNodeClick}
            color={color}
          />
        </div>

        <div className="video-preview-center">
          <ChessBoard
            fen={currentFEN}
            orientation={color === 'white' ? 'white' : 'black'}
            interactive={false}
          />

          <div className="video-embed">
            <iframe
              src={`https://www.youtube.com/embed/${videoImport.youtubeId}?start=${getTimestamp()}`}
              title={videoImport.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>

        <div className="video-preview-sidebar">
          <SaveOptions
            importId={id}
            treeData={treeData}
            color={color}
            onColorChange={setColor}
          />
        </div>
      </div>
    </div>
  );
}
