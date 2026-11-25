// caches.default (the zone cache) is not in the ambient CacheStorage type; one typed accessor keeps the cast in a place.
export function edgeCache(): Cache {
  return (caches as unknown as { default: Cache }).default;
}
