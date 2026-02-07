import { motion } from 'framer-motion';
import { FileDown, Check } from 'lucide-react';
import { fadeUp } from '../utils/animations';
import { Section } from './Section';
import { TiltCard } from './TiltCard';

export function IntegrationsSection() {
  return (
    <Section id="integrations" className="relative z-10 px-6 py-20 md:py-28">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div variants={fadeUp}>
          <span className="text-xs font-bold text-primary tracking-widest uppercase mb-3 block">
            Integrations
          </span>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 font-display text-text">
            Connects to where you play
          </h2>
          <p className="text-text-muted max-w-lg mx-auto leading-relaxed mb-12">
            Seamless integration with the platforms you already use. Import
            studies, sync games, and keep your repertoire up to date.
          </p>
        </motion.div>

        <motion.div variants={fadeUp} custom={1} className="flex flex-wrap justify-center gap-5">
          <TiltCard>
            <div className="flex items-center gap-4 px-8 py-5 bg-white rounded-2xl border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all">
              <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg font-display">li</span>
              </div>
              <div className="text-left">
                <p className="font-bold text-text text-base font-body">Lichess</p>
                <p className="text-xs text-text-muted">Games, studies &amp; profiles</p>
              </div>
              <Check size={18} className="text-green-500 ml-3" />
            </div>
          </TiltCard>

          <TiltCard>
            <div className="flex items-center gap-4 px-8 py-5 bg-white rounded-2xl border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all">
              <div className="w-12 h-12 bg-green-700 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg font-display">c.c</span>
              </div>
              <div className="text-left">
                <p className="font-bold text-text text-base font-body">Chess.com</p>
                <p className="text-xs text-text-muted">Game sync &amp; import</p>
              </div>
              <Check size={18} className="text-green-500 ml-3" />
            </div>
          </TiltCard>

          <TiltCard>
            <div className="flex items-center gap-4 px-8 py-5 bg-white rounded-2xl border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                <FileDown size={22} className="text-white" />
              </div>
              <div className="text-left">
                <p className="font-bold text-text text-base font-body">PGN Files</p>
                <p className="text-xs text-text-muted">Drag &amp; drop import</p>
              </div>
              <Check size={18} className="text-green-500 ml-3" />
            </div>
          </TiltCard>
        </motion.div>
      </div>
    </Section>
  );
}
