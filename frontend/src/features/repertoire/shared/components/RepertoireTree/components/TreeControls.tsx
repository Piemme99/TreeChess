interface TreeControlsProps {
  scale: number;
  onReset: () => void;
}

export function TreeControls({ scale, onReset }: TreeControlsProps) {
  return (
    <div className="tree-controls">
      <button className="tree-control-btn" onClick={onReset} title="Reset view">
        Reset
      </button>
      <span className="tree-zoom-level">{Math.round(scale * 100)}%</span>
    </div>
  );
}
