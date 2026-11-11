import { loadEnv } from "./config/env.js";
import { buildApp } from "./app.js";
import { createMemoryBusinessStore } from "./store/memory.js";
import { createSupabaseBusinessStore } from "./store/supabase.js";

function usesPlaceholderSupabase(supabaseUrl: string): boolean {
  try {
    return new URL(supabaseUrl).hostname === "example.supabase.co";
  } catch {
    return false;
  }
}

async function main() {
  const env = loadEnv();
  const store = usesPlaceholderSupabase(env.SUPABASE_URL)
    ? createMemoryBusinessStore()
    : createSupabaseBusinessStore(env);
  const app = await buildApp(env, store);

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

main();
