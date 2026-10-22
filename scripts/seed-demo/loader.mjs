// Node module hook so the app's own data layer (frontend/src/data/queries,
// frontend/src/utils) runs under plain Node with identical payloads:
//   - '../../lib/supabaseClient' (the only Vite-only module: import.meta.env)
//     resolves to ./supabase-shim.mjs, which exports the seed's signed-in client;
//   - extensionless relative imports ("./customerOrders") get ".js", as Vite does.
const SHIM_URL = new URL('./supabase-shim.mjs', import.meta.url).href

export async function resolve(specifier, context, next) {
  if (/(^|\/)lib\/supabaseClient(\.js)?$/.test(specifier) && context.parentURL?.includes('/frontend/src/')) {
    return { url: SHIM_URL, shortCircuit: true }
  }
  try {
    return await next(specifier, context)
  } catch (error) {
    if (specifier.startsWith('.') && !/\.[cm]?js$/.test(specifier)) return next(`${specifier}.js`, context)
    throw error
  }
}
