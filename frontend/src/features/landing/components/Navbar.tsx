import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Crown } from 'lucide-react';

export function Navbar() {
  return (
    <nav className="relative z-30 px-6 py-5">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary-hover rounded-xl flex items-center justify-center shadow-md shadow-primary/20 group-hover:shadow-lg group-hover:shadow-primary/30 transition-shadow">
            <Crown size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold text-text tracking-tight font-display">
            TreeChess
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-text-muted hover:text-primary transition-colors font-medium">
            Features
          </a>
          <a href="#how-it-works" className="text-sm text-text-muted hover:text-primary transition-colors font-medium">
            How It Works
          </a>
          <a href="#integrations" className="text-sm text-text-muted hover:text-primary transition-colors font-medium">
            Integrations
          </a>
          <motion.a
            href="#cta"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="px-5 py-2.5 bg-gradient-to-r from-primary to-primary-hover text-white text-sm font-semibold rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-shadow"
          >
            Get Started
          </motion.a>
        </div>
      </div>
    </nav>
  );
}
