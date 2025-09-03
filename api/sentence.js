// Thin wrapper (kept simple for Edge)
import originalHandler from "./sentence.inner.js";
export const config = { runtime: "edge" };
export default async function handler(req){ return originalHandler(req); }
