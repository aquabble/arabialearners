import { json } from "./_json.js";
import { Redis } from "@upstash/redis";

export const config = { runtime: "edge" };

export default async function handler() {
  const env = { OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY) };
  let redis = null;
  try {
    const r = Redis.fromEnv();
    await r.ping();
    redis = true;
  } catch {
    redis = false;
  }
  return json({ ok: true, env: { ...env, redis } });
}
