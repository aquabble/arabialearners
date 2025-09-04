
// File: pages/api/glossary.js (Pages Router)
import { findGlossary, normalizeGlossaryForUI } from "@/src/lib/glossary-server";

export const config = { api: { bodyParser: false } };

export default function handler(req, res) {
  const { data, path, tried } = findGlossary(true);
  if (!data) {
    res.status(404).json({ ok:false, error:"Glossary.json not found", tried });
    return;
  }
  const semesters = normalizeGlossaryForUI(data);
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ ok:true, semesters, source:path });
}
