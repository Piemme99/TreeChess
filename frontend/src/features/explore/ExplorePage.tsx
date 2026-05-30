import { useEffect, useState, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Compass, Search } from 'lucide-react';
import { useExploreStore } from '../../stores/exploreStore';
import { ExploreRepertoireCard } from './ExploreRepertoireCard';
import { StarterTemplateCard } from './StarterTemplateCard';
import { Loading, EmptyState } from '../../shared/components/UI';
import type { Color } from '../../types';

type ColorFilter = Color | 'all';
type CategoryFilter = 'starter' | 'community';

export function ExplorePage() {
  const {
    publicRepertoires,
    starterTemplates,
    loading,
    fetchPublicRepertoires,
    fetchStarterTemplates,
    importRepertoire,
    importTemplate
  } = useExploreStore(
    useShallow((s) => ({
      publicRepertoires: s.publicRepertoires,
      starterTemplates: s.starterTemplates,
      loading: s.loading,
      fetchPublicRepertoires: s.fetchPublicRepertoires,
      fetchStarterTemplates: s.fetchStarterTemplates,
      importRepertoire: s.importRepertoire,
      importTemplate: s.importTemplate,
    }))
  );
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importingTemplateId, setImportingTemplateId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [colorFilter, setColorFilter] = useState<ColorFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('community');

  useEffect(() => {
    fetchPublicRepertoires();
    fetchStarterTemplates();
  }, [fetchPublicRepertoires, fetchStarterTemplates]);

  const handleImport = useCallback(async (id: string) => {
    setImportingId(id);
    try {
      await importRepertoire(id);
    } finally {
      setImportingId(null);
    }
  }, [importRepertoire]);

  const handleImportTemplate = useCallback(async (id: string) => {
    setImportingTemplateId(id);
    try {
      await importTemplate(id);
    } finally {
      setImportingTemplateId(null);
    }
  }, [importTemplate]);

  const filteredRepertoires = useMemo(() => {
    let result = publicRepertoires;

    if (colorFilter !== 'all') {
      result = result.filter((r) => r.color === colorFilter);
    }

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.description?.toLowerCase().includes(query) ||
          r.authorName?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [publicRepertoires, colorFilter, searchQuery]);

  const filteredTemplates = useMemo(() => {
    let result = starterTemplates;

    if (colorFilter !== 'all') {
      result = result.filter((t) => t.color === colorFilter);
    }

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [starterTemplates, colorFilter, searchQuery]);

  const hasAnyContent = publicRepertoires.length > 0 || starterTemplates.length > 0;
  const currentItems = categoryFilter === 'starter' ? filteredTemplates : filteredRepertoires;

  if (loading && publicRepertoires.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading size="lg" />
      </div>
    );
  }

  const colorFilters: { value: ColorFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'white', label: 'White' },
    { value: 'black', label: 'Black' },
  ];

  const categoryFilters: { value: CategoryFilter; label: string }[] = [
    { value: 'community', label: 'Community' },
    { value: 'starter', label: 'Starter' },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-hover rounded-xl flex items-center justify-center shadow-md shadow-primary/20">
          <Compass size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text font-display">Explore</h1>
          <p className="text-xs text-text-muted">Discover and import public repertoires from the community</p>
        </div>
      </div>

      {/* Search and filters */}
      {hasAnyContent && (
        <div className="flex items-center gap-3 mb-6">
          {/* Category toggle */}
          <div className="flex items-center rounded-xl border border-primary/10 overflow-hidden shrink-0">
            {categoryFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => setCategoryFilter(f.value)}
                className={`px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer ${
                  categoryFilter === f.value
                    ? 'bg-primary text-white'
                    : 'bg-bg-card text-text-muted hover:text-text hover:bg-bg'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, description, or author..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-primary/10 rounded-xl bg-bg-card text-text focus:outline-none focus:border-primary/40 placeholder:text-text-muted transition-colors"
            />
          </div>

          {/* Color filter buttons */}
          <div className="flex items-center rounded-xl border border-primary/10 overflow-hidden shrink-0">
            {colorFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => setColorFilter(f.value)}
                className={`px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer ${
                  colorFilter === f.value
                    ? 'bg-primary text-white'
                    : 'bg-bg-card text-text-muted hover:text-text hover:bg-bg'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state - nothing at all */}
      {!hasAnyContent && !loading && (
        <EmptyState
          icon="🧭"
          title="No public repertoires yet"
          description="Public repertoires from the community will appear here. Create a repertoire and make it public to share it with others."
        />
      )}

      {/* No results for current filter */}
      {hasAnyContent && currentItems.length === 0 && (
        <EmptyState
          icon="🔍"
          title="No matching repertoires"
          description={searchQuery
            ? `No repertoires match "${searchQuery}". Try a different search term.`
            : 'No repertoires match the selected filter.'}
        />
      )}

      {/* Starter Repertoires */}
      {categoryFilter === 'starter' && filteredTemplates.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest">
              Starter Repertoires
            </h2>
            <span className="text-xs text-text-muted">
              {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredTemplates.map((tmpl, i) => (
              <StarterTemplateCard
                key={tmpl.id}
                template={tmpl}
                onImport={handleImportTemplate}
                importing={importingTemplateId === tmpl.id}
                index={i}
              />
            ))}
          </div>
        </section>
      )}

      {/* Community Repertoires */}
      {categoryFilter === 'community' && filteredRepertoires.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest">
              Community Repertoires
            </h2>
            <span className="text-xs text-text-muted">
              {filteredRepertoires.length}{filteredRepertoires.length !== publicRepertoires.length && ` / ${publicRepertoires.length}`} repertoire{filteredRepertoires.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredRepertoires.map((rep, i) => (
              <ExploreRepertoireCard
                key={rep.id}
                repertoire={rep}
                onImport={handleImport}
                importing={importingId === rep.id}
                index={i}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
