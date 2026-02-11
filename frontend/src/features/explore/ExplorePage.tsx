import { useEffect, useState, useCallback } from 'react';
import { Compass } from 'lucide-react';
import { motion } from 'framer-motion';
import { staggerContainer } from '../../shared/utils/animations';
import { useExploreStore } from '../../stores/exploreStore';
import { ExploreRepertoireCard } from './ExploreRepertoireCard';
import { Loading, EmptyState } from '../../shared/components/UI';

export function ExplorePage() {
  const { publicRepertoires, loading, fetchPublicRepertoires, importRepertoire } = useExploreStore();
  const [importingId, setImportingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPublicRepertoires();
  }, [fetchPublicRepertoires]);

  const handleImport = useCallback(async (id: string) => {
    setImportingId(id);
    try {
      await importRepertoire(id);
    } finally {
      setImportingId(null);
    }
  }, [importRepertoire]);

  if (loading && publicRepertoires.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-[960px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-hover rounded-xl flex items-center justify-center shadow-md shadow-primary/20">
          <Compass size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text font-display">Explore</h1>
          <p className="text-xs text-text-muted">Discover and import public repertoires from the community</p>
        </div>
      </div>

      {/* Empty state */}
      {publicRepertoires.length === 0 && !loading && (
        <EmptyState
          icon="🧭"
          title="No public repertoires yet"
          description="Public repertoires from the community will appear here. Create a repertoire and make it public to share it with others."
        />
      )}

      {/* Repertoire grid */}
      {publicRepertoires.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4">
            Community Repertoires
          </h2>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {publicRepertoires.map((rep, i) => (
              <ExploreRepertoireCard
                key={rep.id}
                repertoire={rep}
                onImport={handleImport}
                importing={importingId === rep.id}
                index={i}
              />
            ))}
          </motion.div>
        </section>
      )}
    </div>
  );
}
