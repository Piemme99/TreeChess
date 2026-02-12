import { Github } from 'lucide-react';

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
              <Github size={14} />
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
