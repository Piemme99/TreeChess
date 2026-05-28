import { useOpeningName } from '../hooks/useOpeningName';

interface OpeningLabelProps {
  /** FENs from the starting position to the current one, in order. */
  fenPath: string[];
  className?: string;
}

/**
 * A slim caption showing the opening name + ECO code for the current position.
 * Renders nothing until an opening is known. Once a line leaves theory it keeps
 * the last known opening and appends an "out of book" hint.
 */
export function OpeningLabel({ fenPath, className = '' }: OpeningLabelProps) {
  const opening = useOpeningName(fenPath);
  if (!opening) return null;

  return (
    <div className={`flex items-center justify-center gap-2 min-w-0 ${className}`}>
      <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[0.65rem] font-mono font-semibold shrink-0">
        {opening.eco}
      </span>
      <span className="text-sm font-medium text-text truncate" title={opening.name}>
        {opening.name}
      </span>
      {!opening.isExact && (
        <span className="text-xs text-text-muted shrink-0">· out of book</span>
      )}
    </div>
  );
}
