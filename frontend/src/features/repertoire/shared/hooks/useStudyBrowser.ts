import { useState, useCallback, useEffect } from 'react';
import { studyApi } from '../../../../services/api';
import { getApiErrorMessage } from '../../../../shared/utils/apiError';
import type { LichessStudyResult, LichessStudyPaginator, StudyBrowseOrder } from '../../../../types';

export interface UseStudyBrowserReturn {
  results: LichessStudyResult[];
  paginator: LichessStudyPaginator | null;
  topics: string[];
  loading: boolean;
  error: string | null;
  query: string;
  selectedTopic: string | null;
  order: StudyBrowseOrder;
  search: (q: string) => void;
  selectTopic: (topic: string | null) => void;
  setOrder: (o: StudyBrowseOrder) => void;
  nextPage: () => void;
  prevPage: () => void;
  clearSearch: () => void;
}

export function useStudyBrowser(): UseStudyBrowserReturn {
  const [results, setResults] = useState<LichessStudyResult[]>([]);
  const [paginator, setPaginator] = useState<LichessStudyPaginator | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [order, setOrderState] = useState<StudyBrowseOrder>('hot');
  const [page, setPage] = useState(1);

  const fetchStudies = useCallback(async (q: string, topic: string | null, ord: StudyBrowseOrder, pg: number) => {
    setLoading(true);
    setError(null);

    try {
      const params: { q?: string; topic?: string; order?: string; page?: number } = { order: ord, page: pg };
      if (q) params.q = q;
      else if (topic) params.topic = topic;

      const data = await studyApi.browse(params);
      setResults(data.paginator.currentPageResults);
      setPaginator(data.paginator);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load studies'));
      setResults([]);
      setPaginator(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load topics on mount
  useEffect(() => {
    studyApi.topics().then((data) => {
      setTopics(data.popular || []);
    }).catch(() => {
      // Silently fail - topics are optional
    });
  }, []);

  // Fetch studies when params change
  useEffect(() => {
    fetchStudies(query, selectedTopic, order, page);
  }, [query, selectedTopic, order, page, fetchStudies]);

  const search = useCallback((q: string) => {
    setQuery(q);
    setSelectedTopic(null);
    setPage(1);
  }, []);

  const selectTopic = useCallback((topic: string | null) => {
    setSelectedTopic(topic);
    setQuery('');
    setPage(1);
  }, []);

  const setOrder = useCallback((o: StudyBrowseOrder) => {
    setOrderState(o);
    setPage(1);
  }, []);

  const nextPage = useCallback(() => {
    if (paginator?.nextPage) {
      setPage(paginator.nextPage);
    }
  }, [paginator]);

  const prevPage = useCallback(() => {
    if (paginator?.previousPage) {
      setPage(paginator.previousPage);
    }
  }, [paginator]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setSelectedTopic(null);
    setPage(1);
    setOrderState('hot');
  }, []);

  return {
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
    clearSearch,
  };
}
