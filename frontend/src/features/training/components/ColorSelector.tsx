import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { fadeUp } from '../../../shared/utils/animations';

interface ColorSelectorProps {
  onSelectColor: (color: 'w' | 'b') => void;
  onBack: () => void;
}

export function ColorSelector({ onSelectColor, onBack }: ColorSelectorProps) {
  return (
    <div className="max-w-3xl mx-auto">
      <motion.div variants={fadeUp} initial="hidden" animate="visible" className="mb-8">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors mb-4 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="text-2xl font-bold font-display text-text mb-2">Pick Your Color</h1>
        <p className="text-text-muted text-sm">
          Choose which side you want to play. The opponent will respond with the most popular moves from real games.
        </p>
      </motion.div>

      <div className="grid grid-cols-2 gap-4 max-w-sm">
        <motion.button
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
          onClick={() => onSelectColor('w')}
          className="flex flex-col items-center gap-3 p-6 rounded-2xl border border-primary/10 bg-bg-card hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all duration-150 cursor-pointer"
        >
          <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-lg font-bold text-gray-800">
            W
          </div>
          <span className="font-medium text-text">White</span>
        </motion.button>

        <motion.button
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={2}
          onClick={() => onSelectColor('b')}
          className="flex flex-col items-center gap-3 p-6 rounded-2xl border border-primary/10 bg-bg-card hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all duration-150 cursor-pointer"
        >
          <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center text-lg font-bold text-white">
            B
          </div>
          <span className="font-medium text-text">Black</span>
        </motion.button>
      </div>
    </div>
  );
}
