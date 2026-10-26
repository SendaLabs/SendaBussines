import { loadEnv } from "./config/env.js";
import { buildApp } from "./app.js";
import { createSupabaseBusinessStore } from "./store/supabase.js";

async function main() {
  const env = loadEnv();
  const app = await buildApp(env, createSupabaseBusinessStore(env));

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

main();
