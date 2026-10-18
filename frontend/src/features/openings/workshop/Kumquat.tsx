import { motion } from 'framer-motion';
import { SPRING, COLOURS } from './theme';

export function Kumquat() {
  return (
    <motion.span className="relative block h-9 w-9" whileHover={{ rotate: -12, scale: 1.08 }} transition={SPRING} aria-hidden="true">
      <span
        className="absolute inset-0 rounded-full"
        style={{ background: `radial-gradient(circle at 35% 30%, ${COLOURS.apricot}, ${COLOURS.kumquat} 55%, ${COLOURS.kumquatDeep})` }}
      />
      <span className="absolute -top-1 left-1/2 h-3 w-4 -translate-x-1/4 rotate-[-25deg] rounded-[100%_0]" style={{ background: COLOURS.sage }} />
    </motion.span>
  );
}
