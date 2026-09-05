import { useCallback, useEffect, useState } from 'react';
import { categoriesApi } from '@/lib/api';
import type { CategoryPublic } from '@streamhub/types';

export function useCategories(): {
  categories: CategoryPublic[];
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [categories, setCategories] = useState<CategoryPublic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const page = await categoriesApi.list({ limit: 50 });
      setCategories(page.items);
      setIsError(false);
      setError(null);
    } catch (e) {
      setIsError(true);
      setError(e instanceof Error ? e.message : 'Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { categories, isLoading, isError, error, refetch };
}