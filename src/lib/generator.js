const HARKAT_REGEX = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
export const stripDiacritics = (s) => s.replace(HARKAT_REGEX, "");
export const WORD_BANK = {
  subjects:[{ar:"أَحْمَد",gloss:"Ahmed"},{ar:"سَارَة",gloss:"Sarah"},{ar:"أَنَا",gloss:"I"},{ar:"نَحنُ",gloss:"we"},{ar:"الطُّلَّاب",gloss:"the students"}],
  verbs:[{ar:"يَكتُبُ",gloss:"writes"},{ar:"يَدرُسُ",gloss:"studies"},{ar:"يَذهَبُ",gloss:"goes"},{ar:"يَأكُلُ",gloss:"eats"},{ar:"يَشرَبُ",gloss:"drinks"}],
  objects:[{ar:"الكِتَاب",gloss:"the book"},{ar:"اللُّغَة العَرَبِيَّة",gloss:"the Arabic language"},{ar:"المَدرَسَة",gloss:"the school"},{ar:"الطَّعَام",gloss:"the food"},{ar:"المَاء",gloss:"the water"}],
  times:[{ar:"اليَوم",gloss:"today"},{ar:"كُلَّ يَومٍ",gloss:"every day"},{ar:"في الصَّبَاح",gloss:"in the morning"},{ar:"مَساءً",gloss:"in the evening"}],
};
export const LEVELS=[{id:1,slots:["subjects","verbs"],label:"SV"},{id:2,slots:["subjects","verbs","objects"],label:"SVO"},{id:3,slots:["subjects","verbs","objects","times"],label:"SVO+Time"}];
export function pickWeighted(arr, mistakes, mastery){
  if(!arr||!arr.length) return null;
  const weighted = arr.flatMap(item=>{
    const miss = mistakes[item.ar]||0, hit = mastery[item.ar]||0;
    const base = 1+miss, decay = Math.max(0, 3 - Math.floor(hit/3));
    const weight = base*(decay+1);
    return Array(weight).fill(item);
  });
  const pool = weighted.length?weighted:arr;
  return pool[Math.floor(Math.random()*pool.length)];
}
export function generateSentence(bank, mistakes, mastery, stage, reviewMode){
  const lvl = LEVELS.find(l=>l.id===stage)||LEVELS[LEVELS.length-1];
  if(reviewMode){
    const topWord = Object.entries(mistakes).sort((a,b)=>b[1]-a[1])[0];
    if(topWord){
      const [word] = topWord;
      for(const slot of Object.keys(bank)){
        const found = bank[slot]?.find?.(x=>x.ar===word);
        if(found){
          const others = lvl.slots.filter(s=>s!==slot).map(s=>pickWeighted(bank[s],mistakes,mastery)).filter(Boolean);
          const tokens = [found, ...others];
          return { ar: tokens.map(t=>t.ar).join(" ")+".", en: tokens.map(t=>t.gloss).join(" ")+".", tokens };
        }
      }
    }
  }
  const tokens = lvl.slots.map(slot=>pickWeighted(bank[slot],mistakes,mastery)).filter(Boolean);
  return { ar: tokens.map(t=>t.ar).join(" ")+".", en: tokens.map(t=>t.gloss).join(" ")+".", tokens };
}
