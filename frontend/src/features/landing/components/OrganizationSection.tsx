import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { fadeUp } from '../utils/animations';
import { Section } from './Section';

const features = [
  'Organize by opening family or personal tags',
  'Drag-and-drop repertoire ordering',
  'Quick search across all variations',
];

const categories = [
  { name: "King's Pawn (e4)", count: 5, color: 'var(--color-primary)' },
  { name: "Queen's Pawn (d4)", count: 3, color: '#f59e0b' },
  { name: 'Indian Defenses', count: 4, color: '#84cc16' },
  { name: 'Anti-Sicilians', count: 2, color: '#06b6d4' },
];

export function OrganizationSection() {
  return (
    <Section className="relative z-10 px-6 py-16 md:py-24">
      <div className="max-w-5xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div variants={fadeUp}>
            <span className="text-xs font-bold text-primary tracking-widest uppercase mb-3 block">
              Organization
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 font-display text-text">
              Keep every opening in its place
            </h2>
            <p className="text-text-muted leading-relaxed mb-6">
              Group your repertoires by category &mdash; King&apos;s Pawn, Queen&apos;s Pawn,
              Indian Defenses, or whatever structure suits you. Color-code,
              tag, and filter to find any line in seconds.
            </p>
            <div className="space-y-3">
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
                    <Check size={12} className="text-primary" />
                  </div>
                  <span className="text-sm text-text-muted">{f}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div variants={fadeUp} custom={1}>
            <div className="bg-white rounded-2xl p-5 border border-primary-light shadow-sm">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-primary-light">
                <div className="w-3 h-3 rounded-full bg-red-300" />
                <div className="w-3 h-3 rounded-full bg-yellow-300" />
                <div className="w-3 h-3 rounded-full bg-green-300" />
                <span className="ml-3 text-xs text-text-muted font-medium tracking-wide uppercase">
                  My Repertoires
                </span>
              </div>
              <div className="space-y-2">
                {categories.map((cat, i) => (
                  <motion.div
                    key={cat.name}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 hover:bg-primary-light/30 hover:border-primary/30 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="text-sm font-medium text-text group-hover:text-primary-dark transition-colors">
                        {cat.name}
                      </span>
                    </div>
                    <span className="text-xs text-text-muted bg-gray-100 px-2 py-0.5 rounded-full">
                      {cat.count} repertoires
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </Section>
  );
}
