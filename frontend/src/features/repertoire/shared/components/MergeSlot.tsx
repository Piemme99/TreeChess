import { useEffect, useRef } from 'react';
import { Button } from '../../../../shared/components/UI';

interface MergeSlotProps {
  selectedCount: number;
  isMerging: boolean;
  mergeName: string;
  loading: boolean;
  onMergeNameChange: (name: string) => void;
  onStartMerging: () => void;
  onCancelMerging: () => void;
  onConfirmMerge: () => void;
}

// Animates a single row open/closed by transitioning grid-template-rows
// between 0fr and 1fr. The inner element is overflow-hidden so its content
// clips during the transition without needing an explicit max-height.
function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`grid transition-[grid-template-rows] duration-200 ease-out ${
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
      }`}
      aria-hidden={!open}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

export function MergeSlot({
  selectedCount,
  isMerging,
  mergeName,
  loading,
  onMergeNameChange,
  onStartMerging,
  onCancelMerging,
  onConfirmMerge,
}: MergeSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // The form is kept mounted across the open/close animation, so autoFocus
  // (which only fires on mount) won't work. Focus on the transition into
  // the merging state instead.
  useEffect(() => {
    if (isMerging) {
      inputRef.current?.focus();
    }
  }, [isMerging]);

  const showBanner = selectedCount >= 2 && !isMerging;
  const showForm = isMerging;

  return (
    <div data-testid="merge-slot">
      <Collapse open={showBanner}>
        <div className="flex items-center justify-between p-3 mb-4 bg-primary-light rounded-lg">
          <span className="text-sm text-text-muted">{selectedCount} repertoires selected</span>
          <Button variant="primary" size="sm" onClick={onStartMerging} disabled={loading}>
            Merge Selected
          </Button>
        </div>
      </Collapse>

      <Collapse open={showForm}>
        <div className="flex flex-col gap-2 p-4 mb-4 bg-primary-light rounded-xl">
          <span className="text-[0.85rem] text-text-muted">
            Merging {selectedCount} repertoires into a new one. All originals will be deleted.
          </span>
          <input
            ref={inputRef}
            type="text"
            value={mergeName}
            onChange={(e) => onMergeNameChange(e.target.value)}
            placeholder="Name for merged repertoire"
            className="flex-1 py-2 px-4 border border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
            onKeyDown={(e) => {
              if (e.key === 'Enter') onConfirmMerge();
              if (e.key === 'Escape') onCancelMerging();
            }}
          />
          <div className="flex gap-2">
            <Button variant="primary" onClick={onConfirmMerge} disabled={loading}>
              Merge
            </Button>
            <Button variant="ghost" onClick={onCancelMerging} disabled={loading}>
              Cancel
            </Button>
          </div>
        </div>
      </Collapse>
    </div>
  );
}
