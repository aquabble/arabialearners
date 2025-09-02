import OpenAI from "openai";
export const config = { runtime: "edge" };
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// normalize vocab here (same as before)...

export default async function handler(req) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error:"OPENAI_API_KEY not set" }), { status:400, headers:{ "Cache-Control":"no-store" }});
    }
    const body = await req.json().catch(()=>({}));
    const { stage="SVO", unit="All", chapter="All", count=5, scopeKey="" } = body;

    // ...load semester1.json and normalize

    // build tasks
    const tasks = Array.from({ length: Math.max(1, Math.min(10,count)) }, () => pickFocus(pool,3));

    const system = `You generate Arabic↔English pairs for learners.
Return STRICT JSON: {"items":[{"ar":"...","en":"...","tokens":["S","V","O"]},...]}.
Stage: ${stage}`

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.45,
      messages:[
        { role:"system", content:system },
        { role:"user", content: JSON.stringify({ stage, unit, chapter, bundles:tasks }) }
      ],
      max_tokens: 360
    })

    const content = completion.choices?.[0]?.message?.content || "{}"
    let out; try { out = JSON.parse(content) } catch { out = {} }
    let items = Array.isArray(out?.items) ? out.items : []

    return new Response(JSON.stringify({ items, scopeKey }), {
      headers:{ "Content-Type":"application/json", "Cache-Control":"no-store" }
    })
  } catch(err){
    return new Response(JSON.stringify({ error:String(err) }), { status:500, headers:{ "Cache-Control":"no-store" }})
  }
}
