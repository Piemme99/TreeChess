import { BADGES, type BadgeKind } from './grades';

export function Badge({ kind }: { kind: BadgeKind }) {
  const { label, glyph, colour } = BADGES[kind];
  if (kind === 'new') {
    return (
      <span title={label} className="inline-flex h-[18px] items-center rounded-full border px-1.5 text-[11px] font-bold leading-none" style={{ borderColor: colour, color: colour }}>
        {glyph}
      </span>
    );
  }
  return (
    <span role="img" aria-label={label} title={label} className="inline-grid size-[18px] shrink-0 place-items-center rounded-full text-[10px] font-extrabold leading-none text-white" style={{ background: colour }}>
      {kind === 'repertoire' ? <Book /> : glyph}
    </span>
  );
}

function Book() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
      <path d="M8 3.5C6.5 2.5 4.5 2.2 2 2.5v10c2.5-.3 4.5 0 6 1 1.5-1 3.5-1.3 6-1v-10c-2.5-.3-4.5 0-6 1Z" fill="none" stroke="white" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 3.5v10" stroke="white" strokeWidth="1.4" />
    </svg>
  );
}
