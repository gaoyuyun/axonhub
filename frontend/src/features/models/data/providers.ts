import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import providersDataRaw from './providers.json';
import { providersDataSchema, type ProvidersData } from './providers.schema';
import { transformToDevelopersData } from './transform-providers';

const UPSTREAM_URL = 'https://raw.githubusercontent.com/ThinkInAIXYZ/PublicProviderConf/refs/heads/dev/dist/all.json';
const STALE_TIME = 1000 * 60 * 60 * 24; // 1 day
const QUERY_KEY = ['providers-upstream-data'];

const localFallback = providersDataSchema.parse(providersDataRaw);
const developersFallback = transformToDevelopersData(localFallback);

async function fetchUpstreamData(): Promise<ProvidersData> {
  const response = await fetch(UPSTREAM_URL);
  if (!response.ok) throw new Error('Failed to fetch upstream providers data');
  const data = await response.json();
  return providersDataSchema.parse(data);
}

async function fetchWithFallback(): Promise<ProvidersData> {
  try {
    return await fetchUpstreamData();
  } catch (error) {
    console.error('Failed to fetch remote providers data, falling back to local:', error);
    return localFallback;
  }
}

export function useProvidersData() {
  return useQuery<ProvidersData>({
    queryKey: QUERY_KEY,
    queryFn: fetchWithFallback,
    staleTime: STALE_TIME,
    placeholderData: localFallback,
  });
}

export function useDevelopersData() {
  return useQuery<ProvidersData>({
    queryKey: [...QUERY_KEY, 'developers'],
    queryFn: async () => {
      const data = await fetchWithFallback();
      return transformToDevelopersData(data);
    },
    staleTime: STALE_TIME,
    placeholderData: developersFallback,
  });
}

export function useRefreshProvidersData() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useCallback(async () => {
    try {
      const data = await fetchUpstreamData();
      queryClient.setQueryData(QUERY_KEY, data);
      queryClient.setQueryData([...QUERY_KEY, 'developers'], transformToDevelopersData(data));
      toast.success(t('models.messages.refreshSuccess'));
    } catch {
      toast.error(t('models.messages.refreshFailed'));
    }
  }, [queryClient, t]);
}
