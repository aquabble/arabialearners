export function getPreferredArabicVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  const arVoices = voices.filter(v => /(^ar-|Arabic)/i.test(v.lang) || /Arabic/i.test(v.name));
  const order = ["ar-SA","ar-EG","ar-JO","ar-AE","ar-MA","ar-TN","ar-IQ","ar-LB","ar-SY"];
  const sorted = arVoices.sort((a,b)=>{
    const ai = order.indexOf(a.lang), bi = order.indexOf(b.lang);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
  return sorted[0] || null;
}
export function speakText(text, voice, { rate = 1 } = {}) {
  if (!window.speechSynthesis) return false;
  const utt = new SpeechSynthesisUtterance(text);
  if (voice) utt.voice = voice;
  utt.lang = voice?.lang || "ar-SA";
  utt.rate = rate;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utt);
  return true;
}
export function stopSpeaking(){ try { window.speechSynthesis?.cancel?.(); } catch {} }
