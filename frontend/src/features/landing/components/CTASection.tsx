import { Link } from 'react-router-dom';
import { Button } from '../../../shared/components/UI';

export function CTASection() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-text mb-4">
          Prêt à progresser ?
        </h2>
        <p className="text-text-muted mb-8">
          Rejoignez TreeChess et commencez à construire votre répertoire dès aujourd'hui.
        </p>
        <Link to="/login?tab=register">
          <Button size="lg">
            Créer un compte gratuit
          </Button>
        </Link>
      </div>
    </section>
  );
}
