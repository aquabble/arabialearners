
// File: app/api/glossary/route.js (App Router)
import { NextResponse } from "next/server";
import { findGlossary, normalizeGlossaryForUI } from "@/src/lib/glossary-server";

export async function GET(req) {
  const { data, path, tried } = findGlossary(true);
  if (!data) return NextResponse.json({ ok:false, error:"Glossary.json not found", tried }, { status: 404 });
  const semesters = normalizeGlossaryForUI(data);
  return new NextResponse(JSON.stringify({ ok:true, semesters, source:path }), {
    status: 200,
    headers: { "Cache-Control": "no-store", "Content-Type": "application/json" }
  });
}
