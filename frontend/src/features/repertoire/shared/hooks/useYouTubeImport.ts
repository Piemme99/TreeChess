import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { videoApi } from '../../../../services/api';
import { toast } from '../../../../stores/toastStore';
import type { SSEProgressEvent, VideoImportStatus } from '../../../../types';

export interface UseYouTubeImportReturn {
  submitting: boolean;
  progress: SSEProgressEvent | null;
  handleYouTubeImport: (url: string) => Promise<void>;
  handleCancel: () => Promise<void>;
}

export function useYouTubeImport(): UseYouTubeImportReturn {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<SSEProgressEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const importIdRef = useRef<string | null>(null);

  const handleCancel = useCallback(async () => {
    const id = importIdRef.current;
    if (!id) return;

    try {
      await videoApi.cancel(id);
    } catch {
      toast.error('Failed to cancel import');
    }
  }, []);

  const handleYouTubeImport = useCallback(async (url: string) => {
    if (!url.trim()) {
      toast.error('Please enter a YouTube URL');
      return;
    }

    setSubmitting(true);
    setProgress(null);

    try {
      const videoImport = await videoApi.submit(url.trim());
      importIdRef.current = videoImport.id;

      // Connect to SSE for progress updates
      const sseURL = videoApi.getProgressURL(videoImport.id);
      const eventSource = new EventSource(sseURL);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data: SSEProgressEvent = JSON.parse(event.data);
          setProgress(data);

          const terminalStatuses: VideoImportStatus[] = ['completed', 'failed', 'cancelled'];
          if (terminalStatuses.includes(data.status)) {
            eventSource.close();
            eventSourceRef.current = null;
            importIdRef.current = null;
            setSubmitting(false);

            if (data.status === 'completed') {
              toast.success('Video import completed!');
              navigate(`/video-import/${videoImport.id}/review`);
            } else if (data.status === 'cancelled') {
              toast.info('Video import cancelled');
            } else {
              toast.error(data.message || 'Video import failed');
            }
          }
        } catch {
          // Ignore parse errors
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        eventSourceRef.current = null;
        importIdRef.current = null;
        setSubmitting(false);
        // Check final status via API
        videoApi.get(videoImport.id).then((vi) => {
          if (vi.status === 'completed') {
            toast.success('Video import completed!');
            navigate(`/video-import/${vi.id}/review`);
          } else if (vi.status === 'failed') {
            toast.error(vi.errorMessage || 'Video import failed');
          } else if (vi.status === 'cancelled') {
            toast.info('Video import cancelled');
          }
        }).catch(() => {
          toast.error('Lost connection to video import progress');
        });
      };
    } catch (error) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      const errorMessage = axiosError.response?.data?.error || 'Failed to submit YouTube import';
      toast.error(errorMessage);
      setSubmitting(false);
    }
  }, [navigate]);

  return { submitting, progress, handleYouTubeImport, handleCancel };
}
