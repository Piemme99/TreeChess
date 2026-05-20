import { Loader2 } from 'lucide-react';
import { useReanalysisStore } from '../../stores/reanalysisStore';

export function ReanalysisIndicator() {
  const { status, isPolling } = useReanalysisStore();
  const visible = isPolling && (status.inProgress || status.pending);
  if (!visible) {
    return null;
  }

  const label = status.inProgress ? 'Re-analyzing games…' : 'Queueing re-analysis…';

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-3 py-2 rounded-full bg-bg-card/90 backdrop-blur-sm border border-primary/20 shadow-lg text-xs font-medium text-text-muted"
    >
      <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
      <span>{label}</span>
    </div>
  );
}
