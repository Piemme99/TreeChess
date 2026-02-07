import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

const studies = [
  { name: 'Sicilian Najdorf', chapters: 12, moves: 340 },
  { name: 'Ruy Lopez Mainline', chapters: 8, moves: 210 },
  { name: "Queen's Gambit Declined", chapters: 15, moves: 480 },
];

export function StudiesScreen() {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-primary-light h-full">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-primary-light">
        <div className="w-3 h-3 rounded-full bg-red-300" />
        <div className="w-3 h-3 rounded-full bg-yellow-300" />
        <div className="w-3 h-3 rounded-full bg-green-300" />
        <span className="ml-3 text-xs text-text-muted font-medium tracking-wide uppercase font-body">
          Lichess Studies
        </span>
      </div>
      <div className="space-y-2">
        {studies.map((s, i) => (
          <motion.div
            key={s.name}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 group hover:border-primary/30 hover:bg-primary-light/30 transition-colors cursor-pointer"
          >
            <div>
              <p className="text-sm font-semibold text-text group-hover:text-primary-dark transition-colors font-body">
                {s.name}
              </p>
              <p className="text-xs text-text-muted font-body">
                {s.chapters} chapters &middot; {s.moves} moves
              </p>
            </div>
            <ChevronRight size={16} className="text-text-light group-hover:text-primary transition-colors" />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
