function GithubIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.21 3.44 9.63 8.21 11.19.6.11.82-.25.82-.56 0-.28-.01-1.02-.02-2-3.34.71-4.04-1.58-4.04-1.58-.55-1.36-1.34-1.73-1.34-1.73-1.09-.73.08-.71.08-.71 1.21.08 1.84 1.22 1.84 1.22 1.07 1.8 2.81 1.28 3.5.98.11-.76.42-1.28.76-1.58-2.67-.3-5.47-1.31-5.47-5.83 0-1.29.47-2.34 1.24-3.17-.12-.3-.54-1.52.12-3.16 0 0 1.01-.32 3.3 1.21a11.6 11.6 0 0 1 3-.4c1.02 0 2.05.13 3 .4 2.29-1.53 3.3-1.21 3.3-1.21.66 1.64.24 2.86.12 3.16.77.83 1.24 1.88 1.24 3.17 0 4.53-2.81 5.53-5.49 5.82.43.36.81 1.08.81 2.18 0 1.58-.01 2.85-.01 3.24 0 .31.22.68.83.56A12.02 12.02 0 0 0 24 12.29C24 5.78 18.63.5 12 .5z" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="relative z-10 px-6 py-12 border-t border-primary/10">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg shadow-sm overflow-hidden">
              <img 
                src="/logo.png" 
                alt="Kumquat" 
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-lg font-bold text-text tracking-tight font-display">
              Kumquat
            </span>
          </div>
          <p className="text-sm text-text-muted">
            Build better chess openings, one move at a time.
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-6 border-t border-primary/10">
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm" aria-label="Footer navigation">
            <a
              href="https://github.com/Piemme99/TreeChess"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-text-muted hover:text-text transition-colors"
            >
              <GithubIcon size={14} />
              GitHub
            </a>
          </nav>
          <div className="text-right">
            <p className="text-xs text-text-light">
              &copy; {new Date().getFullYear()} Kumquat. All rights reserved.
            </p>
            <p className="text-xs text-text-light mt-1">
              Licensed under{' '}
              <a
                href="https://www.gnu.org/licenses/agpl-3.0.html"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-text transition-colors"
              >
                AGPL-3.0
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
