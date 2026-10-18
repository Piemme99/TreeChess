import { useState, type ReactNode } from 'react';

export function Fold({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-2 self-start text-[16px] font-extrabold">
        <span className="inline-block w-4 transition-transform" style={{ transform: open ? 'rotate(90deg)' : undefined }} aria-hidden="true">
          ▸
        </span>
        {title}
      </button>
      {open && children}
    </section>
  );
}
