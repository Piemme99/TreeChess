import { motion } from 'framer-motion';

interface FloatingPieceProps {
  piece: string;
  className: string;
}

export function FloatingPiece({ piece, className }: FloatingPieceProps) {
  return (
    <motion.div
      animate={{ y: [0, -12, 0], rotate: [0, 5, -5, 0] }}
      transition={{ duration: 6 + Math.random() * 3, repeat: Infinity, ease: 'easeInOut' }}
      className={`absolute text-primary/20 select-none pointer-events-none ${className}`}
      style={{ fontSize: '3rem' }}
    >
      {piece}
    </motion.div>
  );
}
