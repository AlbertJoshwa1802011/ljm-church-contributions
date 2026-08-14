// OFFLINE R2 MOCK — an in-memory, Map-backed stand-in for a Cloudflare R2
// bucket binding (env.EVENT_PHOTOS). This is NOT a real Cloudflare R2
// integration test: no network, no Cloudflare credentials, no real bucket.
// Its only purpose is branch coverage — exercising the put()/get()/delete()
// calls in application code that a missing R2 binding would otherwise skip
// entirely (the base64-fallback path). See docs/testing/COVERAGE-TRACKER.md.
//
// Implements just the subset of the R2Bucket interface the app code actually
// uses: put(key, value, options), get(key), delete(key). Deterministic,
// synchronous storage under the hood (a plain Map), wrapped in async methods
// to match the real R2 binding's async signature.
export function makeMockR2(opts = {}) {
  const store = new Map();
  const calls = { put: [], get: [], delete: [] };
  const failOn = opts.failOn || {};

  return {
    // Test-only introspection, not part of the real R2Bucket interface.
    _store: store,
    _calls: calls,

    async put(key, value, options = {}) {
      calls.put.push(key);
      if (failOn.put) throw new Error("mock R2 put failure (injected)");
      store.set(key, { body: value, httpMetadata: options.httpMetadata || {} });
      return { key };
    },

    async get(key) {
      calls.get.push(key);
      if (failOn.get) throw new Error("mock R2 get failure (injected)");
      const obj = store.get(key);
      if (!obj) return null;
      return { body: obj.body, httpMetadata: obj.httpMetadata };
    },

    async delete(key) {
      calls.delete.push(key);
      if (failOn.delete) throw new Error("mock R2 delete failure (injected)");
      store.delete(key);
    }
  };
}
