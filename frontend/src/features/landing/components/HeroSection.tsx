import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { fadeUp } from '../utils/animations';
import { Section } from './Section';
import { useSectionInView } from './SectionInViewContext';

export function HeroSection() {
  const inView = useSectionInView();
  return (
    <Section className="relative z-10 px-6 pt-12 pb-20 md:pt-20 md:pb-28">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Copy */}
          <div>
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate={inView ? 'visible' : 'hidden'}
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
              initial="hidden"
              animate={inView ? 'visible' : 'hidden'}
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
              initial="hidden"
              animate={inView ? 'visible' : 'hidden'}
              custom={2}
              className="text-lg text-text-muted leading-relaxed mb-8 max-w-lg"
            >
              Kumquat turns your opening study into an interactive, visual
              experience. Build move trees, import PGNs, and auto-sync your
              games to find exactly where you went wrong.
            </motion.p>

            <motion.div variants={fadeUp} initial="hidden" animate={inView ? 'visible' : 'hidden'} custom={3} className="flex flex-wrap items-center gap-4">
              <Link
                to="/login?tab=register"
                className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-gradient-to-r from-primary to-primary-hover text-white font-semibold rounded-2xl shadow-lg shadow-primary/20 text-base"
              >
                Sign Up
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-3.5 text-text-muted font-semibold rounded-2xl border border-border hover:border-primary/30 hover:bg-white transition-all text-base"
              >
                Log In
              </Link>
            </motion.div>
          </div>

          {/* Screenshot preview */}
          <motion.div variants={fadeUp} initial="hidden" animate={inView ? 'visible' : 'hidden'} custom={2} className="flex justify-center lg:justify-end">
            <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-xl shadow-primary/10 border border-primary-light bg-white">
              <img
                src="/screenshots/hero.png"
                alt="Kumquat repertoire editor"
                className="w-full h-auto"
                loading="eager"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  target.parentElement!.classList.add('min-h-[300px]', 'flex', 'items-center', 'justify-center');
                  const placeholder = document.createElement('span');
                  placeholder.className = 'text-sm text-text-muted';
                  placeholder.textContent = 'Screenshot coming soon';
                  target.parentElement!.appendChild(placeholder);
                }}
              />
            </div>
          </motion.div>
        </div>
      </div>
    </Section>
  );
}
