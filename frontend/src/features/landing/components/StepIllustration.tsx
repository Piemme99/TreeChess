import { motion } from 'framer-motion';
import { FolderTree, ArrowRight, Check } from 'lucide-react';

interface StepIllustrationProps {
  step: number;
}

export function StepIllustration({ step }: StepIllustrationProps) {
  if (step === 1) {
    return (
      <div className="w-full h-32 flex items-center justify-center relative">
        <div className="relative">
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-16 h-20 bg-white rounded-lg border-2 border-primary/30 shadow-md flex flex-col items-center justify-center gap-1 relative z-10"
          >
            <div className="w-8 h-1 bg-primary/30 rounded" />
            <div className="w-10 h-1 bg-primary/20 rounded" />
            <div className="w-6 h-1 bg-primary/20 rounded" />
            <div className="w-9 h-1 bg-primary/30 rounded" />
            <div className="text-[8px] text-primary font-bold mt-1">.pgn</div>
          </motion.div>
          <motion.div
            animate={{ rotate: [0, 3, 0, -3, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -right-10 top-2 w-14 h-16 bg-primary-light rounded-lg border-2 border-primary/40 flex items-center justify-center"
          >
            <FolderTree size={20} className="text-primary" />
          </motion.div>
          <motion.div
            animate={{ x: [-4, 4, -4] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
            className="absolute -right-4 top-8 text-primary"
          >
            <ArrowRight size={14} />
          </motion.div>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="w-full h-32 flex items-center justify-center">
        <svg width="120" height="100" viewBox="0 0 120 100" className="overflow-visible">
          <motion.circle cx="60" cy="12" r="8" className="fill-primary" animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }} />
          <line x1="60" y1="20" x2="30" y2="50" className="stroke-primary/40" strokeWidth="2" />
          <line x1="60" y1="20" x2="60" y2="50" className="stroke-primary/40" strokeWidth="2" />
          <line x1="60" y1="20" x2="90" y2="50" className="stroke-primary/40" strokeWidth="2" />
          <motion.circle cx="30" cy="55" r="7" className="fill-primary-light stroke-primary" strokeWidth="2" animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2, repeat: Infinity, delay: 0.3 }} />
          <motion.circle cx="60" cy="55" r="7" className="fill-primary-light stroke-primary" strokeWidth="2" animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2, repeat: Infinity, delay: 0.5 }} />
          <motion.circle cx="90" cy="55" r="7" className="fill-primary-light stroke-primary" strokeWidth="2" animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2, repeat: Infinity, delay: 0.7 }} />
          <line x1="30" y1="62" x2="18" y2="85" className="stroke-primary/25" strokeWidth="1.5" />
          <line x1="30" y1="62" x2="42" y2="85" className="stroke-primary/25" strokeWidth="1.5" />
          <line x1="90" y1="62" x2="82" y2="85" className="stroke-primary/25" strokeWidth="1.5" />
          <line x1="90" y1="62" x2="102" y2="85" className="stroke-primary/25" strokeWidth="1.5" />
          <circle cx="18" cy="89" r="5" className="fill-primary-light stroke-primary/40" strokeWidth="1.5" />
          <circle cx="42" cy="89" r="5" className="fill-primary-light stroke-primary/40" strokeWidth="1.5" />
          <circle cx="82" cy="89" r="5" className="fill-primary-light stroke-primary/40" strokeWidth="1.5" />
          <circle cx="102" cy="89" r="5" className="fill-primary-light stroke-primary/40" strokeWidth="1.5" />
        </svg>
      </div>
    );
  }

  // Step 3 - Analyze illustration
  return (
    <div className="w-full h-32 flex items-center justify-center">
      <div className="flex items-end gap-2 relative">
        {[40, 65, 50, 80, 70, 92].map((h, i) => (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            animate={{ height: h }}
            transition={{ delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="w-4 rounded-t-md"
            style={{
              background: i === 5 ? 'var(--color-primary)' : i === 3 ? 'var(--color-primary-hover)' : 'var(--color-primary-light)',
            }}
          />
        ))}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.8, type: 'spring', stiffness: 200 }}
          className="absolute -top-4 -right-4 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/20"
        >
          <Check size={14} className="text-white" strokeWidth={3} />
        </motion.div>
      </div>
    </div>
  );
}
