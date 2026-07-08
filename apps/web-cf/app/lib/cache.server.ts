// The Workers runtime exposes caches.default (the zone cache), which the ambient DOM
// CacheStorage type does not model. One typed accessor keeps the cast in a single place.
export function edgeCache(): Cache {
  return (caches as unknown as { default: Cache }).default;
}
