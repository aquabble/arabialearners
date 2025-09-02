export const HARKAT_REGEX = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
export const stripDiacritics = (s) => (s || "").replace(HARKAT_REGEX, "");

export const WORD_BANK = {
  subjects: [
    { ar: "الطالب", gloss: "the student" },
    { ar: "المعلم", gloss: "the teacher" },
    { ar: "أحمد", gloss: "Ahmed" },
    { ar: "سارة", gloss: "Sarah" }
  ],
  verbs: [
    { ar: "يقرأ", gloss: "reads" },
    { ar: "يكتب", gloss: "writes" },
    { ar: "يأكل", gloss: "eats" },
    { ar: "يشرب", gloss: "drinks" }
  ],
  objects: [
    { ar: "الكتاب", gloss: "the book" },
    { ar: "الطعام", gloss: "the food" },
    { ar: "الماء", gloss: "the water" },
    { ar: "النص", gloss: "the text" }
  ],
  times: [
    { ar: "اليوم", gloss: "today" },
    { ar: "الآن", gloss: "now" },
    { ar: "صباحًا", gloss: "in the morning" },
    { ar: "مساءً", gloss: "in the evening" }
  ]
};

export const LEVELS = [
  { id: 1, slots: ["subjects", "verbs"], label: "SV" },
  { id: 2, slots: ["subjects", "verbs", "objects"], label: "SVO" },
  { id: 3, slots: ["subjects", "verbs", "objects", "times"], label: "SVO+Time" }
];

export function pickWeighted(arr){
  if (!arr || !arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateSentence(bank=WORD_BANK, levelId=2){
  const lvl = LEVELS.find(l => l.id === levelId) || LEVELS[1];
  const picks = {};
  for (const slot of lvl.slots){
    const item = pickWeighted(bank[slot]);
    if (!item) continue;
    picks[slot] = item;
  }
  const ar = [picks.subjects?.ar, picks.verbs?.ar, picks.objects?.ar, picks.times?.ar].filter(Boolean).join(" ");
  const en = [picks.subjects?.gloss, picks.verbs?.gloss, picks.objects?.gloss, picks.times?.gloss].filter(Boolean).join(" ");
  return { ar, en };
}
