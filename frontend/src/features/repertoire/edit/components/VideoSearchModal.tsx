import { useEffect } from 'react';
import { Modal, Loading } from '../../../../shared/components/UI';
import { useVideoSearch } from '../hooks/useVideoSearch';
import type { VideoSearchResult } from '../../../../types';

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface VideoSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  fen: string;
}

export function VideoSearchModal({ isOpen, onClose, fen }: VideoSearchModalProps) {
  const { results, loading, searched, search, reset } = useVideoSearch();

  useEffect(() => {
    if (isOpen && fen) {
      search(fen);
    }
    if (!isOpen) {
      reset();
    }
  }, [isOpen, fen, search, reset]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Videos with this position">
      {loading && <Loading text="Searching videos..." />}

      {!loading && searched && results.length === 0 && (
        <p className="video-search-empty">No videos found for this position.</p>
      )}

      {!loading && results.length > 0 && (
        <ul className="video-search-results">
          {results.map((result: VideoSearchResult) => (
            <li key={result.videoImport.id} className="video-search-result">
              <h4>{result.videoImport.title || 'Untitled video'}</h4>

              <div className="video-embed">
                <iframe
                  src={`https://www.youtube.com/embed/${result.videoImport.youtubeId}?start=${Math.floor(result.positions[0]?.timestampSeconds || 0)}`}
                  title={result.videoImport.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>

              {result.positions.length > 1 && (
                <ul className="video-search-timestamps">
                  {result.positions.map((pos) => (
                    <li key={pos.id}>
                      <a
                        className="video-search-timestamp"
                        href={`https://www.youtube.com/watch?v=${result.videoImport.youtubeId}&t=${Math.floor(pos.timestampSeconds)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {formatTimestamp(pos.timestampSeconds)}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
