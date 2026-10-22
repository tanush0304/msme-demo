// Stand-in for frontend/src/lib/supabaseClient.js (see loader.mjs): the seed
// creates ONE client, signs it in as the phase's demo user and sets it here
// before importing any app module. null in --dry-run (nothing may call it).
export const supabase = globalThis.__SEED_SUPABASE__ ?? null
