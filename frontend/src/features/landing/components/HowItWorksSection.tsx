import { motion } from 'framer-motion';
import { fadeUp } from '../utils/animations';
import { Section } from './Section';
import { TiltCard } from './TiltCard';
import { StepIllustration } from './StepIllustration';

const steps = [
  {
    step: 1,
    title: 'Import your games',
    desc: 'Connect your Lichess or Chess.com account, or drop in a PGN file. We handle the rest.',
  },
  {
    step: 2,
    title: 'Build your tree',
    desc: 'Organize your openings into visual, branching move trees. Add notes, group by category, and explore variations.',
  },
  {
    step: 3,
    title: 'Find deviations',
    desc: 'TreeChess compares your actual games against your repertoire and highlights where you went off-book.',
  },
];

export function HowItWorksSection() {
  return (
    <Section id="how-it-works" className="relative z-10 px-6 py-20 md:py-28">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundColor: 'rgba(253, 242, 230, 0.5)' }}
      />
      <div className="max-w-5xl mx-auto relative">
        <motion.div variants={fadeUp} className="text-center mb-16">
          <span className="text-xs font-bold text-primary tracking-widest uppercase mb-3 block">
            How It Works
          </span>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 font-display text-text">
            Three steps to a better repertoire
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 md:gap-6">
          {steps.map((item, i) => (
            <motion.div key={item.step} variants={fadeUp} custom={i}>
              <TiltCard>
                <div className="bg-white rounded-3xl p-7 border border-primary-light shadow-sm hover:shadow-md hover:shadow-primary/10 transition-shadow h-full">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary-hover text-white flex items-center justify-center font-bold text-sm mb-5 shadow-md shadow-primary/15">
                    {item.step}
                  </div>
                  <StepIllustration step={item.step} />
                  <h3 className="text-lg font-bold text-text mt-5 mb-2 font-display">
                    {item.title}
                  </h3>
                  <p className="text-sm text-text-muted leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
}
