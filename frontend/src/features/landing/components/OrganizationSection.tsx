import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ImageOff } from 'lucide-react';
import { fadeUp } from '../utils/animations';
import { Section } from './Section';
import { useSectionInView } from './SectionInViewContext';

const features = [
  'Organize by opening family or personal tags',
  'Drag-and-drop repertoire ordering',
  'Quick search across all variations',
];

export function OrganizationSection() {
  const [imgError, setImgError] = useState(false);
  const inView = useSectionInView();

  return (
    <Section className="relative z-10 px-6 py-16 md:py-24">
      <div className="max-w-5xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div variants={fadeUp} initial="hidden" animate={inView ? 'visible' : 'hidden'}>
            <span className="text-xs font-bold text-primary tracking-widest uppercase mb-3 block">
              Organization
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 font-display text-text">
              Keep every opening in its place
            </h2>
            <p className="text-text-muted leading-relaxed mb-6">
              Group your repertoires by category &mdash; King&apos;s Pawn, Queen&apos;s Pawn,
              Indian Defenses, or whatever structure suits you. Color-code,
              tag, and filter to find any line in seconds.
            </p>
            <div className="space-y-3">
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
                    <Check size={12} className="text-primary" />
                  </div>
                  <span className="text-sm text-text-muted">{f}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div variants={fadeUp} initial="hidden" animate={inView ? 'visible' : 'hidden'} custom={1}>
            {imgError ? (
              <div className="bg-white rounded-2xl border border-primary-light shadow-sm min-h-[300px] flex flex-col items-center justify-center gap-3 text-text-muted">
                <ImageOff size={32} className="text-primary/30" />
                <span className="text-sm">Screenshot coming soon</span>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-primary-light shadow-sm overflow-hidden">
                <img
                  src="/screenshots/organization.png"
                  alt="Repertoire organization with categories"
                  className="w-full h-auto"
                  loading="lazy"
                  onError={() => setImgError(true)}
                />
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </Section>
  );
}
