import type { LayoutMode } from '../utils/types';

interface TreeControlsProps {
  scale: number;
  onReset: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  layoutMode: LayoutMode;
  onToggleLayoutMode: () => void;
  onFocusSelected?: () => void;
}

export function TreeControls({
  scale,
  onReset,
  isExpanded,
  onToggleExpand,
  layoutMode,
  onToggleLayoutMode,
  onFocusSelected
}: TreeControlsProps) {
  const layoutModeLabel = layoutMode === 'radial' ? 'Switch to tidy tree' : 'Switch to radial tree';
  const expandLabel = isExpanded ? 'Collapse' : 'Expand fullscreen';
  return (
    <div className="absolute top-2 right-2 flex gap-2 items-center z-10">
      <button
        className="py-1 px-2 bg-bg border border-border rounded-sm text-xs cursor-pointer hover:bg-border focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        onClick={onToggleLayoutMode}
        title={layoutModeLabel}
        aria-label={layoutModeLabel}
      >
        {layoutMode === 'radial' ? '⊤' : '◎'}
      </button>
      {onToggleExpand && (
        <button
          className="py-1 px-2 bg-bg border border-border rounded-sm text-xs cursor-pointer hover:bg-border focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          onClick={onToggleExpand}
          title={expandLabel}
          aria-label={expandLabel}
        >
          {isExpanded ? '\u2715' : '\u26F6'}
        </button>
      )}
      {onFocusSelected && (
        <button
          className="py-1 px-2 bg-bg border border-border rounded-sm text-xs cursor-pointer hover:bg-border focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          onClick={onFocusSelected}
          title="Focus on selected node"
          aria-label="Focus on selected node"
        >
          ⌖
        </button>
      )}
      <button
        className="py-1 px-2 bg-bg border border-border rounded-sm text-xs cursor-pointer hover:bg-border focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        onClick={onReset}
        title="Reset view"
        aria-label="Reset view"
      >
        Reset
      </button>
      <span className="text-xs text-text-muted">{Math.round(scale * 100)}%</span>
    </div>
  );
}
