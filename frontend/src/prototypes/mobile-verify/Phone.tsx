// PROTOTYPE JETABLE — un cadre de téléphone sur ordinateur, plein écran sur un vrai téléphone.
import type { ReactNode } from 'react';

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto h-dvh w-full overflow-hidden bg-bg sm:my-8 sm:h-[844px] sm:w-[390px] sm:rounded-[48px] sm:border-[10px] sm:border-neutral-900 sm:shadow-2xl">
      <div className="flex h-full flex-col overflow-y-auto pb-14 sm:pb-0">{children}</div>
    </div>
  );
}

export interface Notification {
  title: string;
  body: string;
  when: string;
}

export function LockScreen({ notification, onOpen }: { notification: Notification; onOpen: () => void }) {
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-slate-700 to-slate-950 px-3 pt-16 text-white">
      <p className="text-center text-sm text-white/70">Saturday 17 October</p>
      <p className="text-center text-7xl font-light tracking-tight">18:42</p>
      <button
        onClick={onOpen}
        className="mt-10 flex gap-3 rounded-3xl bg-white/15 p-3 text-left backdrop-blur-md transition hover:bg-white/25"
      >
        <img src="/apple-touch-icon.png" alt="" className="h-9 w-9 shrink-0 rounded-lg" />
        <span className="flex min-w-0 flex-col">
          <span className="flex justify-between gap-2 text-sm font-semibold">
            <span>{notification.title}</span>
            <span className="font-normal text-white/60">{notification.when}</span>
          </span>
          <span className="text-sm leading-snug text-white/90">{notification.body}</span>
        </span>
      </button>
      <p className="mt-auto pb-8 text-center text-xs text-white/50">Tap the notification</p>
    </div>
  );
}

export function AppBar({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-bg/95 px-4 pb-3 pt-12 backdrop-blur">
      {onBack ? (
        <button onClick={onBack} className="-ml-1 px-1 text-xl text-text-muted" aria-label="Back">
          ‹
        </button>
      ) : null}
      <h1 className="font-display text-lg text-text">{title}</h1>
    </header>
  );
}
