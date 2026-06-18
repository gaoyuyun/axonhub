import { DEVELOPER_IDS } from './constants';
import type { ProvidersData, Provider, ProviderModel } from './providers.schema';
import extraModelsRaw from './extra-models.json';

const KWAIPILOT_DEVELOPER_ID = 'kwaipilot';

type ExtraModelsMap = Record<string, ProviderModel[]>;
const extraModels: ExtraModelsMap = extraModelsRaw as ExtraModelsMap;

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function getMetadataItemKey(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `array:${JSON.stringify(value)}`;
  if (typeof value === 'object') return `object:${JSON.stringify(value)}`;
  return `${typeof value}:${String(value)}`;
}

function mergeDefined(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  if (!isObject(target) || !isObject(source)) return target;

  for (const [key, value] of Object.entries(source)) {
    if (value == null) continue;

    if (Array.isArray(value)) {
      if (!Array.isArray(target[key])) {
        target[key] = deepClone(value);
        continue;
      }
      const merged = [...(target[key] as unknown[])];
      const existingKeys = new Set(merged.map((item) => getMetadataItemKey(item)));
      for (const item of value) {
        const k = getMetadataItemKey(item);
        if (!existingKeys.has(k)) {
          existingKeys.add(k);
          merged.push(item);
        }
      }
      target[key] = merged;
      continue;
    }

    if (isObject(value)) {
      if (!isObject(target[key])) target[key] = {};
      mergeDefined(target[key] as Record<string, unknown>, value as Record<string, unknown>);
      continue;
    }

    if (target[key] == null || target[key] === '') {
      target[key] = value;
    }
  }

  return target;
}

function normalizeKATSuffix(modelId: string): string {
  const trimmed = (modelId || '').trim();
  if (!trimmed) return '';
  const slashIndex = trimmed.indexOf('/');
  return (slashIndex >= 0 ? trimmed.slice(slashIndex + 1) : trimmed).trim().toLowerCase();
}

function isKATFamilyModel(model: ProviderModel): boolean {
  const modelId = model.id || '';
  const family = (model.family || '').toLowerCase();
  return (
    family === 'kat-coder' ||
    /^kwaipilot\//i.test(modelId) ||
    /^kuaishou\//i.test(modelId) ||
    /(^|\/)(kat-coder|kat-dev)/i.test(modelId)
  );
}

function buildKWAIPilotProvider(data: ProvidersData): Provider | null {
  const modelsByID = new Map<string, ProviderModel>();

  for (const provider of Object.values(data.providers)) {
    const models = provider.models || [];
    for (const model of models) {
      if (!isKATFamilyModel(model)) continue;
      const normalizedID = normalizeKATSuffix(model.id);
      if (!normalizedID) continue;

      const normalizedModel = deepClone(model);
      normalizedModel.id = normalizedID;
      normalizedModel.family = normalizedModel.family || 'kat-coder';

      const existing = modelsByID.get(normalizedID);
      if (existing) {
        mergeDefined(existing as unknown as Record<string, unknown>, normalizedModel as unknown as Record<string, unknown>);
      } else {
        modelsByID.set(normalizedID, normalizedModel);
      }
    }
  }

  if (modelsByID.size === 0) return null;

  return {
    id: KWAIPILOT_DEVELOPER_ID,
    name: 'KwaiPilot',
    display_name: 'KwaiPilot',
    models: Array.from(modelsByID.values()),
  };
}

function filterProviders(data: ProvidersData, allowedIds: string[]): ProvidersData {
  const filtered: Record<string, Provider> = {};

  for (const [key, value] of Object.entries(data.providers)) {
    if (value.id && allowedIds.includes(value.id)) {
      // The developer view sorts and augments its provider data. Clone selected
      // providers so deriving that view cannot mutate the shared full-data cache.
      filtered[key] = deepClone(value);
    }
  }

  if (allowedIds.includes('meta') && data.providers.llama) {
    const llamaProvider = data.providers.llama;
    const llamaModels = (llamaProvider.models || []).filter((m) => m.id?.toLowerCase().startsWith('llama'));
    if (llamaModels.length > 0) {
      filtered.meta = { ...llamaProvider, id: 'meta', name: 'Meta', display_name: 'Meta', models: llamaModels };
    }
  }

  if (allowedIds.includes('bytedance') && data.providers.doubao) {
    const doubaoProvider = data.providers.doubao;
    const doubaoModels = (doubaoProvider.models || []).filter((m) => m.id?.toLowerCase().startsWith('doubao'));
    if (doubaoModels.length > 0) {
      filtered.bytedance = { ...doubaoProvider, id: 'bytedance', name: 'ByteDance', display_name: 'ByteDance', models: doubaoModels };
    }
  }

  if (allowedIds.includes('xiaomi')) {
    const xiaomiTokenPlanKeys = ['xiaomi-token-plan-cn', 'xiaomi-token-plan-sgp', 'xiaomi-token-plan-ams'];
    const mergedModels = new Map<string, ProviderModel>();
    const baseProvider = filtered.xiaomi || data.providers.xiaomi || null;

    if (baseProvider) {
      for (const model of baseProvider.models || []) {
        mergedModels.set(model.id, deepClone(model));
      }
    }

    for (const key of xiaomiTokenPlanKeys) {
      const provider = data.providers[key];
      if (!provider) continue;
      for (const model of provider.models || []) {
        if (!mergedModels.has(model.id)) {
          mergedModels.set(model.id, deepClone(model));
        }
      }
    }

    if (mergedModels.size > 0) {
      filtered.xiaomi = {
        ...(baseProvider || {}),
        id: 'xiaomi',
        name: 'Xiaomi',
        display_name: 'Xiaomi',
        models: Array.from(mergedModels.values()),
      };
    }
  }

  if (allowedIds.includes(KWAIPILOT_DEVELOPER_ID)) {
    const kwaipilotProvider = buildKWAIPilotProvider(data);
    if (kwaipilotProvider) {
      filtered[KWAIPILOT_DEVELOPER_ID] = kwaipilotProvider;
    }
  }

  if (allowedIds.includes('nvidia') && filtered.nvidia) {
    const nvidiaProvider = filtered.nvidia;
    const nvidiaModels = (nvidiaProvider.models || []).filter((m) => m.id?.toLowerCase().startsWith('nvidia/'));
    if (nvidiaModels.length > 0) {
      filtered.nvidia = { ...nvidiaProvider, models: nvidiaModels };
    }
  }

  return { providers: filtered };
}

function sortModelsByDate(data: ProvidersData): ProvidersData {
  for (const provider of Object.values(data.providers)) {
    if (provider.models && Array.isArray(provider.models)) {
      provider.models.sort((a, b) => {
        const dateA = a.release_date ? new Date(a.release_date).getTime() : 0;
        const dateB = b.release_date ? new Date(b.release_date).getTime() : 0;
        return dateB - dateA;
      });
    }
  }
  return data;
}

function mergeExtraModels(data: ProvidersData): ProvidersData {
  for (const [providerKey, models] of Object.entries(extraModels)) {
    if (data.providers[providerKey]) {
      const existingProvider = data.providers[providerKey];
      if (!existingProvider.models) existingProvider.models = [];
      const existingIds = new Set(existingProvider.models.map((m) => m.id));
      for (const model of models) {
        if (!existingIds.has(model.id)) {
          existingProvider.models.push(model);
          existingIds.add(model.id);
        }
      }
    } else {
      data.providers[providerKey] = { id: providerKey, models };
    }
  }
  return data;
}

export function transformToDevelopersData(data: ProvidersData): ProvidersData {
  const filtered = filterProviders(data, DEVELOPER_IDS);
  mergeExtraModels(filtered);
  sortModelsByDate(filtered);
  return filtered;
}
