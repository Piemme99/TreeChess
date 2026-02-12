import { Link } from 'react-router-dom';

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
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Footer navigation">
            <Link to="/legal" className="text-text-muted hover:text-text transition-colors">
              Legal
            </Link>
            <Link to="/terms" className="text-text-muted hover:text-text transition-colors">
              Terms
            </Link>
            <Link to="/privacy" className="text-text-muted hover:text-text transition-colors">
              Privacy
            </Link>
            <Link to="/contact" className="text-text-muted hover:text-text transition-colors">
              Contact
            </Link>
          </nav>
          <p className="text-xs text-text-light">
            &copy; {new Date().getFullYear()} Kumquat. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
