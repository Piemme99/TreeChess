import { motion } from 'framer-motion';

const moves = [
  { depth: 0, move: '1. e4', active: true },
  { depth: 1, move: '1... e5', active: true },
  { depth: 2, move: '2. Nf3', active: true },
  { depth: 3, move: '2... Nc6', active: true },
  { depth: 3, move: '2... d6', active: false },
  { depth: 3, move: '2... Nf6', active: false },
  { depth: 2, move: '2. Bc4', active: false },
  { depth: 1, move: '1... c5', active: false },
  { depth: 1, move: '1... e6', active: false },
];

export function TreeScreen() {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-primary-light h-full">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-primary-light">
        <div className="w-3 h-3 rounded-full bg-red-300" />
        <div className="w-3 h-3 rounded-full bg-yellow-300" />
        <div className="w-3 h-3 rounded-full bg-green-300" />
        <span className="ml-3 text-xs text-text-muted font-medium tracking-wide uppercase font-body">
          Repertoire &mdash; Italian Game
        </span>
      </div>
      <div className="space-y-1">
        {moves.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4 }}
            className="flex items-center gap-1"
            style={{ paddingLeft: m.depth * 20 }}
          >
            {m.depth > 0 && (
              <span className="text-primary/30 mr-1 text-xs">&#9492;</span>
            )}
            <span
              className={`px-3 py-1.5 rounded-lg text-sm font-medium font-body transition-colors ${
                m.active
                  ? 'bg-primary-light text-primary-dark border border-primary/30'
                  : 'bg-gray-50 text-text-muted border border-gray-100'
              }`}
            >
              {m.move}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
