export const cache = {
  bodyShapeAnalysis: new Map(),
  outfitSuggestions: new Map(),
  products: new Map(),
};

export const CACHE_EXPIRATION = 30 * 60 * 1000;

export function getCacheKey(data) {
  try {
    const normalized = JSON.stringify(data, (key, value) => {
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        return Object.keys(value)
          .sort()
          .reduce((result, key) => {
            result[key] = value[key];
            return result;
          }, {});
      }
      return value;
    });
    return normalized;
  } catch (error) {
    console.warn("Error generating cache key:", error.message);
    return `fallback-${Date.now()}`;
  }
}

export function getFromCache(cacheStore, key) {
  const cacheItem = cacheStore.get(key);
  if (!cacheItem) return null;
  if (Date.now() > cacheItem.expiry) {
    cacheStore.delete(key);
    return null;
  }
  return cacheItem.data;
}

export function saveToCache(cacheStore, key, data) {
  cacheStore.set(key, {
    data: data,
    expiry: Date.now() + CACHE_EXPIRATION,
  });
}

export function cleanupCache() {
  const now = Date.now();
  
  for (const [key, value] of cache.bodyShapeAnalysis.entries()) {
    if (now > value.expiry) {
      cache.bodyShapeAnalysis.delete(key);
    }
  }

  for (const [key, value] of cache.outfitSuggestions.entries()) {
    if (now > value.expiry) {
      cache.outfitSuggestions.delete(key);
    }
  }

  for (const [key, value] of cache.products.entries()) {
    if (now > value.expiry) {
      cache.products.delete(key);
    }
  }
}