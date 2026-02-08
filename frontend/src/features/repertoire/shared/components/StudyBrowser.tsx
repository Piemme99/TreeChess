import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Heart, BookOpen, User } from 'lucide-react';
import { Button } from '../../../../shared/components/UI/Button';
import { Loading } from '../../../../shared/components/UI/Loading';
import { EmptyState } from '../../../../shared/components/UI/EmptyState';
import { useStudyBrowser } from '../hooks/useStudyBrowser';
import type { StudyBrowseOrder } from '../../../../types';

interface StudyBrowserProps {
  onSelectStudy: (studyId: string) => void;
}

const ORDER_OPTIONS: { value: StudyBrowseOrder; label: string }[] = [
  { value: 'hot', label: 'Hot' },
  { value: 'popular', label: 'Popular' },
  { value: 'newest', label: 'Newest' },
];

export function StudyBrowser({ onSelectStudy }: StudyBrowserProps) {
  const {
    results,
    paginator,
    topics,
    loading,
    error,
    query,
    selectedTopic,
    order,
    search,
    selectTopic,
    setOrder,
    nextPage,
    prevPage,
  } = useStudyBrowser();

  const [searchInput, setSearchInput] = useState('');

  const handleSearch = () => {
    if (searchInput.trim()) {
      search(searchInput.trim());
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            className="w-full py-2 pl-10 pr-4 border border-primary/10 rounded-xl text-[0.9rem] bg-bg text-text focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
            placeholder="Search studies..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <Button onClick={handleSearch} disabled={!searchInput.trim()} size="md">
          Search
        </Button>
      </div>

      {/* Topic chips */}
      {topics.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-thin">
          {topics.slice(0, 12).map((topic) => (
            <button
              key={topic}
              onClick={() => selectTopic(selectedTopic === topic ? null : topic)}
              className={`shrink-0 px-3 py-1 rounded-full text-[0.8rem] border transition-colors cursor-pointer ${
                selectedTopic === topic
                  ? 'bg-primary text-white border-primary'
                  : 'bg-bg border-primary/10 text-text-muted hover:bg-primary-light/30 hover:text-text'
              }`}
            >
              {topic}
            </button>
          ))}
        </div>
      )}

      {/* Sort selector */}
      <div className="flex items-center gap-1">
        <span className="text-[0.8rem] text-text-muted mr-1">Sort:</span>
        {ORDER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setOrder(opt.value)}
            className={`px-3 py-1 rounded-full text-[0.8rem] border transition-colors cursor-pointer ${
              order === opt.value
                ? 'bg-primary text-white border-primary'
                : 'bg-bg border-primary/10 text-text-muted hover:bg-primary-light/30 hover:text-text'
            }`}
          >
            {opt.label}
          </button>
        ))}
        {query && (
          <span className="ml-auto text-[0.8rem] text-text-muted">
            Results for "{query}"
          </span>
        )}
        {selectedTopic && (
          <span className="ml-auto text-[0.8rem] text-text-muted">
            Topic: {selectedTopic}
          </span>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loading size="md" text="Loading studies..." />
        </div>
      ) : error ? (
        <p className="text-danger text-[0.85rem] text-center py-4">{error}</p>
      ) : results.length === 0 ? (
        <EmptyState
          icon="\uD83D\uDD0D"
          title="No studies found"
          description="Try a different search query or topic."
        />
      ) : (
        <div className="flex flex-col gap-2 max-h-[340px] overflow-y-auto">
          {results.map((study, i) => (
            <motion.button
              key={study.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.03 }}
              onClick={() => onSelectStudy(study.id)}
              className="flex flex-col gap-1 p-3 border border-primary/10 rounded-xl bg-bg hover:bg-primary-light/20 cursor-pointer text-left transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-[0.9rem] text-text leading-tight">{study.name}</span>
                <div className="flex items-center gap-1 shrink-0 text-text-muted">
                  <Heart className="w-3.5 h-3.5" />
                  <span className="text-[0.75rem]">{study.likes}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[0.8rem] text-text-muted">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {study.owner.name}
                </span>
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  {study.chapters.length} chapter{study.chapters.length !== 1 ? 's' : ''}
                </span>
              </div>
              {study.topics.length > 0 && (
                <div className="flex gap-1 flex-wrap mt-0.5">
                  {study.topics.slice(0, 4).map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-full text-[0.7rem] bg-primary-light/40 text-text-muted">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </motion.button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {paginator && paginator.nbPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={prevPage}
            disabled={!paginator.previousPage}
          >
            Previous
          </Button>
          <span className="text-[0.85rem] text-text-muted">
            Page {paginator.currentPage} of {paginator.nbPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={nextPage}
            disabled={!paginator.nextPage}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
