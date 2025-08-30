export const DIFFICULTY_LABELS = { 0: "Intro", 1: "Beginner", 2: "Lower-Intermediate", 3: "Intermediate", 4: "Upper-Intermediate", 5: "Advanced" };
export function userKey(user, k){ return user ? `${user.email}_${k}` : k; }
export function todayISO(){ const d=new Date(); d.setHours(0,0,0,0); return d.toISOString().slice(0,10); }
export function recordActivity(user){
  if(!user) return;
  const last = localStorage.getItem(userKey(user,'last_active_date'));
  const today = todayISO();
  if(last===today) return;
  const current = Number(localStorage.getItem(userKey(user,'streak_current'))||0);
  const best = Number(localStorage.getItem(userKey(user,'streak_best'))||0);
  let next = 1;
  if(last){ const diffDays = Math.floor((new Date(today) - new Date(last))/(1000*60*60*24)); next = diffDays===1 ? current+1 : 1; }
  localStorage.setItem(userKey(user,'streak_current'), String(next));
  localStorage.setItem(userKey(user,'streak_best'), String(Math.max(best,next)));
  localStorage.setItem(userKey(user,'last_active_date'), today);
  if([3,7,30].includes(next)) awardBadge(user,`streak_${next}`,`🔥 ${next}-Day Streak`,`Logged study ${next} days in a row`);
}
export function getBadges(user){ try { return JSON.parse(localStorage.getItem(userKey(user,'badges'))||'[]'); } catch { return []; } }
export function awardBadge(user, id, title, desc){
  if(!user) return; const arr = getBadges(user);
  if(arr.some(b=>b.id===id)) return;
  arr.push({ id, title, desc, ts: Date.now() });
  localStorage.setItem(userKey(user,'badges'), JSON.stringify(arr));
}
export function learnedCount(wordStats){ return Object.values(wordStats||{}).filter(s => (s.correct_streak||0) >= 15).length; }
