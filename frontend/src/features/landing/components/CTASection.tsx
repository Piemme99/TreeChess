import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { fadeUp } from '../utils/animations';
import { Section } from './Section';

export function CTASection() {
  return (
    <Section id="cta" className="relative z-10 px-6 py-20 md:py-28">
      <div className="max-w-3xl mx-auto text-center">
        <motion.div
          variants={fadeUp}
          className="bg-gradient-to-br from-primary-light via-white to-primary-light rounded-3xl p-10 md:p-14 border border-primary/20 shadow-lg shadow-primary/10 relative overflow-hidden"
        >
          {/* Decorative background pieces */}
          <div className="absolute top-6 left-8 text-primary/15 text-5xl select-none pointer-events-none">
            {'\u2654'}
          </div>
          <div className="absolute bottom-6 right-8 text-primary/15 text-5xl select-none pointer-events-none">
            {'\u265B'}
          </div>

          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 relative font-display text-text">
            Ready to build your repertoire?
          </h2>
          <p className="text-text-muted leading-relaxed mb-8 max-w-md mx-auto relative">
            Start using TreeChess to study openings more effectively. Free to
            start, no credit card required.
          </p>
          <motion.div
            whileHover={{ scale: 1.05, boxShadow: '0 24px 48px -12px rgba(230, 126, 34, 0.4)' }}
            whileTap={{ scale: 0.97 }}
            className="inline-block"
          >
            <Link
              to="/login?tab=register"
              className="inline-flex items-center gap-2.5 px-9 py-4 bg-gradient-to-r from-primary to-primary-hover text-white font-bold rounded-2xl shadow-lg shadow-primary/20 text-lg relative"
            >
              Get Started Free
              <ArrowRight size={20} />
            </Link>
          </motion.div>
          <p className="text-xs text-text-light mt-4 relative">
            No credit card required &middot; Free forever for basic use
          </p>
        </motion.div>
      </div>
    </Section>
  );
}
