import { useScroll, useTransform } from 'framer-motion';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { FeatureShowcase } from './components/FeatureShowcase';
import { HowItWorksSection } from './components/HowItWorksSection';
import { IntegrationsSection } from './components/IntegrationsSection';
import { OrganizationSection } from './components/OrganizationSection';
import { CTASection } from './components/CTASection';
import { Footer } from './components/Footer';
import { FloatingPiece } from './components/FloatingPiece';

export function LandingPage() {
  const { scrollYProgress } = useScroll();
  const bgY = useTransform(scrollYProgress, [0, 1], [0, -100]);

  return (
    <div
      className="min-h-screen relative overflow-hidden bg-bg-landing font-body text-text"
      style={{ scrollBehavior: 'smooth' }}
    >
      {/* Dot pattern background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.35]"
        style={{
          backgroundImage: 'radial-gradient(circle, #e7c9a0 0.8px, transparent 0.8px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Floating chess pieces decorations */}
      <FloatingPiece piece={'\u2655'} className="top-[15%] left-[3%] hidden lg:block" />
      <FloatingPiece piece={'\u265E'} className="top-[30%] right-[4%] hidden lg:block" />
      <FloatingPiece piece={'\u2657'} className="top-[55%] left-[5%] hidden lg:block" />
      <FloatingPiece piece={'\u265C'} className="top-[70%] right-[3%] hidden lg:block" />
      <FloatingPiece piece={'\u2659'} className="top-[85%] left-[8%] hidden lg:block" />

      <Navbar />
      <HeroSection bgY={bgY} />
      <FeatureShowcase />
      <HowItWorksSection />
      <IntegrationsSection />
      <OrganizationSection />
      <CTASection />
      <Footer />
    </div>
  );
}
