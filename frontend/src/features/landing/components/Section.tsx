import { useRef } from 'react';
import { useInView } from 'framer-motion';
import { SectionInViewContext } from './SectionInViewContext';

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export function Section({ children, className = '', id }: SectionProps) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <SectionInViewContext.Provider value={inView}>
      <section id={id} ref={ref} className={className}>
        {children}
      </section>
    </SectionInViewContext.Provider>
  );
}
