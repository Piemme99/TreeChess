import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

const accounts = [
  { name: 'Lichess', user: 'ChessEnthusiast', synced: '2 min ago', games: 1247 },
  { name: 'Chess.com', user: 'ChessEnthusiast', synced: '5 min ago', games: 893 },
];

export function SyncScreen() {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-primary-light h-full">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-primary-light">
        <div className="w-3 h-3 rounded-full bg-red-300" />
        <div className="w-3 h-3 rounded-full bg-yellow-300" />
        <div className="w-3 h-3 rounded-full bg-green-300" />
        <span className="ml-3 text-xs text-text-muted font-medium tracking-wide uppercase font-body">
          Connected Accounts
        </span>
      </div>
      <div className="space-y-3">
        {accounts.map((a, i) => (
          <motion.div
            key={a.name}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.12 }}
            className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl border border-gray-100"
          >
            <div>
              <p className="text-sm font-semibold text-text font-body">{a.name}</p>
              <p className="text-xs text-text-muted font-body">@{a.user} &middot; {a.synced}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-primary font-body">{a.games.toLocaleString()}</p>
              <p className="text-xs text-text-muted">games</p>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg">
        <RefreshCw size={12} className="animate-spin" style={{ animationDuration: '3s' }} />
        <span className="font-body">Auto-sync active &mdash; checking every 30 minutes</span>
      </div>
    </div>
  );
}
