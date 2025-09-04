
// API DIFFICULTY-LENGTH PATCH v4 (UI-safe)
// - Mirrors bundle behavior for one sentence.
// - Honors difficulty-based length + min lexicon hits when lexicon is available.

import { OpenAI } from "openai";
import fs from "fs";
import path from "path";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
export const config = { api: { bodyParser: true } };

function safeParse(body) { if (!body) return {}; if (typeof body === "object") return body; try { return JSON.parse(body); } catch { return {}; } }
const AR_HARAKAT = /[\u064B-\u065F\u0670]/g;
function normArabic(s){return (s||"").replace(AR_HARAKAT,"").replace(/\u0622/g,"\u0627").replace(/\u0623/g,"\u0627").replace(/\u0625/g,"\u0627").replace(/\u0649/g,"\u064A").replace(/\u0629/g,"\u0647").replace(/[^\u0600-\u06FF\s]/g,"").trim();}
function normLatin(s){return (s||"").toLowerCase().replace(/[^a-z0-9\s\-']/g," ").replace(/\s+/g," ").trim();}
function countHits(text,lex){ if(!Array.isArray(lex)||!lex.length) return 0; const ar=normArabic(text), en=normLatin(text); let hits=0; const seen=new Set(); for(const wRaw of lex){ const w=typeof wRaw==="string"?wRaw:(wRaw?.word||""); if(!w) continue; const wAr=normArabic(w), wEn=normLatin(w); let found=false; if(wAr && ar.includes(wAr)) found=true; if(!found && wEn){ const re=new RegExp(`\\b${wEn.replace(/[.*+?^${}()|[\\]\\/]/g,"\\$&")}\\b`,"i"); if(en && re.test(en)) found=true; } if(found && !seen.has(w)){ hits++; seen.add(w);} } return hits; }
function difficultyRules(d){ d=(d||"").toLowerCase(); if(d==="short"||d==="easy") return {length:"short", wordsRange:[4,8], minHits:1}; if(d==="long"||d==="hard") return {length:"long", wordsRange:[12,20], minHits:2, preferMaxHits:3}; return {length:"medium", wordsRange:[8,12], minHits:2}; }
function extractJSON(text){ if(typeof text!=="string")return null; const s=text.indexOf("{"), e=text.lastIndexOf("}"); if(s===-1||e===-1||e<=s)return null; try{return JSON.parse(text.slice(s,e+1));}catch{return null;} }
async function callModel(payload, sys){ const resp = await client.chat.completions.create({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", temperature: 0.8, top_p: 0.9, frequency_penalty: 0.35, presence_penalty: 0.25, response_format:{type:"json_object"}, messages:[{role:"system",content:sys},{role:"user",content:JSON.stringify(payload)}] }); const raw = resp.choices?.[0]?.message?.content ?? "{}"; try{ return JSON.parse(raw);}catch{return extractJSON(raw)||{};} }

function loadLocalLexicon(){
  try{
    const p = path.join(process.cwd(), "data", "lexicon.json");
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8"));
  }catch{} return null;
}
function pickLexicon(local, semester, unit, chapter){
  if (Array.isArray(local)) return local;
  if (local && typeof local === "object") {
    const s = semester ?? "All", u = unit ?? "All", c = chapter ?? "All";
    let arr = local?.[s]?.[u]?.[c]; if (Array.isArray(arr)) return arr;
    arr = local?.[s]?.[u] || local?.[s] || local?.["All"]; if (Array.isArray(arr)) return arr;
    if (Array.isArray(local?.["All"]?.["All"]?.["All"])) return local["All"]["All"]["All"];
  }
  return [];
}

export default async function handler(req, res){
  if (req.method !== "POST"){ res.status(405).json({error:"Method not allowed"}); return; }
  res.setHeader("Cache-Control", "no-store");
  try{
    const body = safeParse(req.body);
    const difficulty = body.difficulty ?? "medium";
    const semester = body.semester ?? body.sem ?? "All";
    const unit = body.unit ?? "All";
    const chapter = body.chapter ?? "All";
    const direction = body.direction ?? "ar2en";
    const topic = body.topic ?? "";
    const timeModeRaw = body.timeMode ?? body.time ?? "None";
    const timeText = (body.timeText ?? "").toString().trim();
    const seed = (body.seed ?? Math.floor(Math.random()*1e9)) + "";
    const mustUseTime = (("" + timeModeRaw).toLowerCase() !== "none") || (timeText.length > 0);
    const rules = difficultyRules(difficulty);

    let lexicon = Array.isArray(body.lexicon) ? body.lexicon : [];
    if (!lexicon.length) { const local = loadLocalLexicon(); lexicon = pickLexicon(local, semester, unit, chapter) || []; }

    const sys = `Generate ONE sentence pair for Arabic↔English learners. Return {"item":{"ar":"...","en":"..."}}. Target ${rules.length} length (${rules.wordsRange[0]}–${rules.wordsRange[1]} words on source side) and include at least ${rules.minHits}${rules.preferMaxHits?"-"+rules.preferMaxHits:""} curriculum vocab word(s) when available.`;

    const payload = {
      difficulty, length_rule: rules, semester, unit, chapter, direction, topic,
      time: mustUseTime ? (timeText || "today / this evening") : null,
      style_seed: seed, lexicon,
      enforce: { min_lexicon_hits: rules.minHits, prefer_hits_upto: rules.preferMaxHits || rules.minHits, source_word_range: rules.wordsRange }
    };

    let parsed = await callModel(payload, sys);
    let item = parsed?.item || parsed?.sentence || null;
    if (!item || typeof item !== "object") {
      item = direction === "ar2en" ? { ar: "الطقسُ جميلٌ اليوم.", en: "The weather is nice today." } : { en: "I finished my homework.", ar: "أنهيتُ واجبي المنزلي." };
    }

    // Optional repair if under-hitting and lexicon present
    if (lexicon && lexicon.length) {
      const src = direction === "ar2en" ? item.ar : item.en;
      const hits = countHits(src||"", lexicon);
      if (hits < rules.minHits) {
        const rpSys = `Rewrite the item to include at least ${rules.minHits} lexicon word(s) (prefer up to ${rules.preferMaxHits || rules.minHits}) while keeping it natural and within ${rules.wordsRange[0]}–${rules.wordsRange[1]} source-side words. Output {"item":{"ar","en"}}.`;
        parsed = await callModel({ direction, item, lexicon, length_rule: rules }, rpSys);
        const repaired = parsed?.item || item;
        item = repaired;
      }
    }

    res.status(200).json({ ok: true, item, sentence: item, rules, hits_enforced: !!(lexicon && lexicon.length) });
  }catch(err){
    console.error(err);
    res.status(500).json({ ok:false, error:"Internal error", detail: String(err && err.message || err) });
  }
}
