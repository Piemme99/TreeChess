import { useState, useCallback } from 'react';
import { Loading } from '../../../../shared/components/UI';
import type { UseYouTubeImportReturn } from '../hooks/useYouTubeImport';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Starting...',
  downloading: 'Downloading video...',
  extracting: 'Extracting frames...',
  recognizing: 'Recognizing positions...',
  building_tree: 'Building repertoire tree...',
  completed: 'Completed!',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export interface YouTubeImportProps {
  youtubeImportState: UseYouTubeImportReturn;
  disabled?: boolean;
}

export function YouTubeImport({ youtubeImportState, disabled }: YouTubeImportProps) {
  const { submitting, progress, handleYouTubeImport, handleCancel } = youtubeImportState;
  const [url, setUrl] = useState('');

  const handleSubmit = useCallback(() => {
    handleYouTubeImport(url);
  }, [handleYouTubeImport, url]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !submitting && !disabled) {
      handleSubmit();
    }
  }, [handleSubmit, submitting, disabled]);

  const isDisabled = submitting || disabled;

  return (
    <div className="youtube-import">
      <div className="youtube-import-input">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="https://www.youtube.com/watch?v=..."
          disabled={isDisabled}
        />
        <button
          className="btn btn-primary btn-md"
          onClick={handleSubmit}
          disabled={isDisabled || !url.trim()}
        >
          {submitting ? (
            <Loading text="Processing..." size="sm" />
          ) : (
            'Import from YouTube'
          )}
        </button>
      </div>

      {progress && submitting && (
        <div className="youtube-progress">
          <div className="youtube-progress-bar">
            <div
              className="youtube-progress-fill"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
          <div className="youtube-progress-info">
            <span className="youtube-progress-status">
              {STATUS_LABELS[progress.status] || progress.status}
            </span>
            <span className="youtube-progress-pct">{progress.progress}%</span>
          </div>
          {progress.message && (
            <p className="youtube-progress-message">{progress.message}</p>
          )}
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleCancel}
            type="button"
          >
            Cancel
          </button>
        </div>
      )}

      {progress && progress.status === 'failed' && (
        <div className="youtube-error">
          <p>{progress.message}</p>
        </div>
      )}
    </div>
  );
}
