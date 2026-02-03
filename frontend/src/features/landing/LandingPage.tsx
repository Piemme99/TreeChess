import { HeroSection } from './components/HeroSection';
import { FeaturesSection } from './components/FeaturesSection';
import { CTASection } from './components/CTASection';
import { Footer } from './components/Footer';

export function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-bg animate-fade-in">
      <HeroSection />
      <FeaturesSection />
      <CTASection />
      <Footer />
    </div>
  );
}
