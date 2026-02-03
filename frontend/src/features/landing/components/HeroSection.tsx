import { Link } from 'react-router-dom';
import { Button } from '../../../shared/components/UI';

export function HeroSection() {
  return (
    <section className="py-20 px-4 text-center">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-text mb-6">
          Maîtrisez vos{' '}
          <span className="text-primary">ouvertures</span>
        </h1>
        <p className="text-lg md:text-xl text-text-muted mb-10 max-w-2xl mx-auto">
          Créez des répertoires visuels intuitifs, analysez vos parties et progressez avec un outil conçu pour les joueurs d'échecs ambitieux.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/login?tab=register">
            <Button size="lg">
              Commencer gratuitement
            </Button>
          </Link>
          <Link to="/login">
            <Button variant="secondary" size="lg">
              Se connecter
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
