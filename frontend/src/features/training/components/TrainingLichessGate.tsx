import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';

export function TrainingLichessGate() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-xl mx-auto py-16 px-6 text-center"
    >
      <div className="mx-auto mb-6 w-14 h-14 rounded-2xl bg-primary-light/40 flex items-center justify-center">
        <Lock className="w-7 h-7 text-primary" aria-hidden="true" />
      </div>
      <h1 className="font-display text-2xl mb-3">Connect your Lichess account</h1>
      <p className="text-text-muted mb-8">
        Training pulls live opening data from Lichess. To keep things fair under
        Lichess&rsquo;s rate limits, every player uses their own Lichess token —
        connect your account to unlock training.
      </p>
      <Link
        to="/profile"
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-hover px-5 py-3 text-white font-medium shadow-md shadow-primary/20 hover:brightness-110 transition"
      >
        Connect Lichess
      </Link>
    </motion.div>
  );
}
