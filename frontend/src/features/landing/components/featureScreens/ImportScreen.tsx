import { motion } from 'framer-motion';
import { FileDown } from 'lucide-react';

export function ImportScreen() {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-primary-light h-full">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-primary-light">
        <div className="w-3 h-3 rounded-full bg-red-300" />
        <div className="w-3 h-3 rounded-full bg-yellow-300" />
        <div className="w-3 h-3 rounded-full bg-green-300" />
        <span className="ml-3 text-xs text-text-muted font-medium tracking-wide uppercase font-body">
          Import &amp; Analyze
        </span>
      </div>
      <div className="border-2 border-dashed border-primary/30 rounded-xl p-8 text-center mb-4 bg-primary-light/30">
        <FileDown className="mx-auto mb-2 text-primary" size={28} />
        <p className="text-sm text-text-muted font-body">
          Drop your PGN file here
        </p>
      </div>
      <div className="space-y-2">
        {['game_rapid_2024.pgn', 'tournament_r3.pgn'].map((f, i) => (
          <motion.div
            key={f}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.1 }}
            className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-100"
          >
            <span className="text-sm text-text-muted font-body">{f}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary-light text-primary font-medium">
              3 deviations
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
