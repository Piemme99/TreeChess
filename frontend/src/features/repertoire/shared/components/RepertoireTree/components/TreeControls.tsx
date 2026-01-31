interface TreeControlsProps {
  scale: number;
  onReset: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function TreeControls({ scale, onReset, isExpanded, onToggleExpand }: TreeControlsProps) {
  return (
    <div className="absolute top-2 right-2 flex gap-2 items-center z-10">
      {onToggleExpand && (
        <button
          className="py-1 px-2 bg-bg border border-border rounded-sm text-xs cursor-pointer hover:bg-border focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          onClick={onToggleExpand}
          title={isExpanded ? 'Collapse' : 'Expand fullscreen'}
        >
          {isExpanded ? '\u2715' : '\u26F6'}
        </button>
      )}
      <button
        className="py-1 px-2 bg-bg border border-border rounded-sm text-xs cursor-pointer hover:bg-border focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        onClick={onReset}
        title="Reset view"
      >
        Reset
      </button>
      <span className="text-xs text-text-muted">{Math.round(scale * 100)}%</span>
    </div>
  );
}
