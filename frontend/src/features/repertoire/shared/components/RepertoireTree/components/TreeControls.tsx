interface TreeControlsProps {
  scale: number;
  onReset: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function TreeControls({ scale, onReset, isExpanded, onToggleExpand }: TreeControlsProps) {
  return (
    <div className="tree-controls">
      {onToggleExpand && (
        <button className="tree-control-btn" onClick={onToggleExpand} title={isExpanded ? 'Collapse' : 'Expand fullscreen'}>
          {isExpanded ? '✕' : '⛶'}
        </button>
      )}
      <button className="tree-control-btn" onClick={onReset} title="Reset view">
        Reset
      </button>
      <span className="tree-zoom-level">{Math.round(scale * 100)}%</span>
    </div>
  );
}
