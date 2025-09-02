// scripts/apply_words_patch.js
// Usage: node scripts/apply_words_patch.js
// This script modifies your existing files in-place to wire up the Words tab feature.

const fs = require('fs');
const path = require('path');

function read(p){ return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; }
function write(p, txt){ fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, txt, 'utf8'); }

const ROOT = process.cwd();

function patchTranslateGame(){
  const p = path.join(ROOT, 'src', 'components', 'TranslateGame.jsx');
  let txt = read(p);
  if (!txt) { console.log('[skip] TranslateGame.jsx not found'); return; }

  if (!/recordResult/.test(txt)){
    txt = txt.replace(
      "import { API_BASE } from '../lib/apiBase.js'",
      "import { API_BASE } from '../lib/apiBase.js'\nimport { recordResult } from '../lib/wordStats.js'"
    );
    console.log('[ok] import recordResult added');
  }

  // ensure size not count
  txt = txt.replace(/"count:/g, '"size:');

  // insert recordResult call after setFeedback(data)
  if (!/recordResult\(/.test(txt)){
    txt = txt.replace(/setFeedback\(data\)\s*\}/, "setFeedback(data);\n      try { recordResult({ arSentence: ar, tokens, verdict: data?.verdict }); } catch {}\n    }");
    console.log('[ok] recordResult call inserted');
  }

  write(p, txt);
  console.log('[done] TranslateGame.jsx patched');
}

function patchStudyShell(){
  const p = path.join(ROOT, 'src', 'components', 'StudyShell.jsx');
  let txt = read(p);
  if (!txt) { console.log('[skip] StudyShell.jsx not found'); return; }

  if (!/value:'words'/.test(txt)){
    txt = txt.replace(
      "{label:'Word Order', value:'word-order'}",
      "{label:'Word Order', value:'word-order'},\n    {label:'Words', value:'words'}"
    );
    write(p, txt);
    console.log('[done] StudyShell.jsx patched (Words tab added)');
  } else {
    console.log('[skip] StudyShell.jsx already has Words tab');
  }
}

function patchApp(){
  const p = path.join(ROOT, 'src', 'App.jsx');
  let txt = read(p);
  if (!txt) { console.log('[skip] App.jsx not found'); return; }

  if (!/from '\.\/components\/Words\.jsx'/.test(txt)){
    txt = txt.replace(
      "import WordOrderGame from './components/WordOrderGame.jsx'",
      "import WordOrderGame from './components/WordOrderGame.jsx'\nimport Words from './components/Words.jsx'"
    );
    console.log('[ok] import Words added');
  }

  if (!/mode === 'words'/.test(txt)){
    txt = txt.replace(
      "{mode === 'word-order' && <WordOrderGame user={user} />}",
      "{mode === 'word-order' && <WordOrderGame user={user} />}\n      {mode === 'words' && <Words user={user} />}"
    );
    console.log('[ok] words route added');
  }

  write(p, txt);
  console.log('[done] App.jsx patched');
}

function writeNewFiles(){
  const wordsPath = path.join(ROOT, 'src', 'components', 'Words.jsx');
  const statsPath = path.join(ROOT, 'src', 'lib', 'wordStats.js');

  if (!fs.existsSync(wordsPath)){
    fs.copyFileSync(path.join(__dirname, '..', 'src', 'components', 'Words.jsx'), wordsPath);
    console.log('[done] Created src/components/Words.jsx');
  } else {
    console.log('[skip] src/components/Words.jsx already exists');
  }

  if (!fs.existsSync(statsPath)){
    fs.copyFileSync(path.join(__dirname, '..', 'src', 'lib', 'wordStats.js'), statsPath);
    console.log('[done] Created src/lib/wordStats.js');
  } else {
    console.log('[skip] src/lib/wordStats.js already exists');
  }
}

(function main(){
  console.log('Applying Words tab hotpatch...');
  writeNewFiles();
  patchTranslateGame();
  patchStudyShell();
  patchApp();
  console.log('All set.');
})();
