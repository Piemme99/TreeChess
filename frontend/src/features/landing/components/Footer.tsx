import { Link } from 'react-router-dom';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto py-8 px-4 border-t border-border bg-bg-sidebar">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold text-text">
              Tree<span className="text-primary">Chess</span>
            </h2>
            <p className="text-sm text-text-muted mt-1">
              Votre outil de répertoire d'ouvertures
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Footer navigation">
            <Link to="/legal" className="text-text-muted hover:text-text transition-colors">
              Mentions légales
            </Link>
            <Link to="/terms" className="text-text-muted hover:text-text transition-colors">
              CGU
            </Link>
            <Link to="/privacy" className="text-text-muted hover:text-text transition-colors">
              Confidentialité
            </Link>
            <Link to="/contact" className="text-text-muted hover:text-text transition-colors">
              Contact
            </Link>
          </nav>
        </div>
        <div className="mt-8 pt-6 border-t border-border text-center text-sm text-text-muted">
          &copy; {currentYear} TreeChess. Tous droits réservés.
        </div>
      </div>
    </footer>
  );
}
