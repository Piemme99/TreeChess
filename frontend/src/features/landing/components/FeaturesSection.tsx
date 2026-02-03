import { FeatureCard } from './FeatureCard';

function TreeIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="13" y2="11" />
    </svg>
  );
}

function AnalysisIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L15 8H9L12 2Z" />
      <circle cx="12" cy="14" r="4" />
      <path d="M8 22h8" />
      <path d="M12 18v4" />
    </svg>
  );
}

const features = [
  {
    icon: <TreeIcon />,
    title: 'Répertoires d\'ouvertures',
    description: 'Construisez et visualisez vos répertoires sous forme d\'arbres interactifs. Organisez vos variantes, ajoutez des commentaires et maîtrisez vos lignes préférées.',
  },
  {
    icon: <AnalysisIcon />,
    title: 'Analyse de parties',
    description: 'Importez vos parties depuis Lichess, Chess.com ou fichiers PGN. Comparez vos coups à votre répertoire et identifiez vos erreurs d\'ouverture.',
  },
];

export function FeaturesSection() {
  return (
    <section className="py-16 px-4 bg-bg-sidebar">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-text text-center mb-4">
          Tout ce dont vous avez besoin
        </h2>
        <p className="text-text-muted text-center mb-12 max-w-xl mx-auto">
          Des outils puissants pour améliorer votre jeu d'ouverture
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature) => (
            <FeatureCard
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
