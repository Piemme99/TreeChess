import { BADGES, type BadgeKind } from './grades';

/** `labelled` : le nom est écrit à côté, la pastille n'a pas à le redire au lecteur d'écran. */
export function Badge({ kind, labelled = false }: { kind: BadgeKind; labelled?: boolean }) {
  const { label, glyph, colour, ink, outline } = BADGES[kind];
  const a11y = labelled ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label };
  if (kind === 'new') {
    return (
      <span {...a11y} title={label} className="inline-flex h-[18px] items-center rounded-full border px-1.5 text-[11px] font-bold leading-none" style={{ borderColor: colour, color: colour }}>
        {glyph}
      </span>
    );
  }
  return (
    <span
      {...a11y}
      title={label}
      className="inline-grid size-[18px] shrink-0 place-items-center rounded-full text-[10px] font-extrabold leading-none"
      style={outline ? { border: `1.5px solid ${colour}`, color: colour } : { background: colour, color: ink ?? 'white' }}
    >
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
