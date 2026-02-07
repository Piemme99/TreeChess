import { Link } from 'react-router-dom';
import { motion, MotionValue } from 'framer-motion';
import { Zap, ArrowRight, MousePointerClick } from 'lucide-react';
import { fadeUp } from '../utils/animations';
import { Section } from './Section';
import { MiniChessBoard } from './MiniChessBoard';

interface HeroSectionProps {
  bgY: MotionValue<number>;
}

export function HeroSection({ bgY }: HeroSectionProps) {
  return (
    <Section className="relative z-10 px-6 pt-12 pb-20 md:pt-20 md:pb-28">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Copy */}
          <div>
            <motion.div
              variants={fadeUp}
              custom={0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-light border border-primary/30 rounded-full mb-8"
            >
              <Zap size={14} className="text-primary" />
              <span className="text-xs font-semibold text-primary-dark tracking-wide uppercase">
                Your opening repertoire, perfected
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              custom={1}
              className="text-4xl md:text-5xl lg:text-[3.5rem] font-bold leading-[1.1] tracking-tight mb-6 font-display text-text"
            >
              Build chess openings{' '}
              <span className="bg-gradient-to-r from-primary to-primary-hover bg-clip-text text-transparent">
                you actually remember
              </span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              custom={2}
              className="text-lg text-text-muted leading-relaxed mb-8 max-w-lg"
            >
              TreeChess turns your opening study into an interactive, visual
              experience. Build move trees, import PGNs, and auto-sync your
              games to find exactly where you went wrong.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="flex flex-wrap items-center gap-4">
              <motion.div
                whileHover={{ scale: 1.04, boxShadow: '0 20px 40px -12px rgba(230, 126, 34, 0.35)' }}
                whileTap={{ scale: 0.97 }}
              >
                <Link
                  to="/login?tab=register"
                  className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-gradient-to-r from-primary to-primary-hover text-white font-semibold rounded-2xl shadow-lg shadow-primary/20 text-base"
                >
                  Start Building
                  <ArrowRight size={18} />
                </Link>
              </motion.div>
              <a
                href="#features"
                className="inline-flex items-center gap-2 px-6 py-3.5 text-text-muted font-semibold rounded-2xl border border-border hover:border-primary/30 hover:bg-white transition-all text-base"
              >
                See Features
              </a>
            </motion.div>
          </div>

          {/* Interactive chess board */}
          <motion.div variants={fadeUp} custom={2} className="flex justify-center lg:justify-end relative">
            <motion.div style={{ y: bgY }} className="relative">
              <MiniChessBoard />
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-sm border border-primary-light rounded-full shadow-sm">
                <MousePointerClick size={12} className="text-primary" />
                <span className="text-[11px] text-text-muted font-medium">Hover squares to see moves</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </Section>
  );
}
