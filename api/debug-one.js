// Returns a fixed pair so you can verify the frontend renders a sentence.
import { json } from "./_json.js";
export const config = { runtime: "edge" };
export default async function handler(req) {
  return json({
    id: (typeof crypto?.randomUUID === "function") ? crypto.randomUUID() : String(Date.now()),
    ar: "اختبار قصير",
    en: "Short test sentence.",
    source: "debug-one"
  });
}
