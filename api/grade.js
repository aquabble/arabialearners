
import OpenAI from "openai";

export const config = { runtime: "edge" };

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req) {
  try {
    const { direction = "ar2en", guess = "", referenceAr = "", referenceEn = "" } = await req.json();

    const system = `You are an Arabic↔English tutor.
Return STRICT JSON: {"verdict":"correct|minor|wrong","hint":"short helpful hint"}.
Rules:
- "ar2en": student sees Arabic and must produce English.
- "en2ar": student sees English and must produce Arabic.
- Ignore Arabic diacritics and extra whitespace when comparing.
- Accept natural synonyms if the meaning is preserved.
- "minor" = same meaning but small grammar/wording/word-order issues.
- Keep hint short and actionable (Arabic or English as appropriate).`;

    const user = { direction, guess, referenceAr, referenceEn };

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(user) },
      ],
    });

    const content = completion.choices?.[0]?.message?.content || "{}";
    return new Response(content, { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
