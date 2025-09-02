// scripts/apply_words_nav_patch.js
// Run: node scripts/apply_words_nav_patch.js
// Adds "Words" entry to Header dropdown and Home quick links, and ensures tab/route are wired.

const fs = require('fs');
const path = require('path');

function read(p){ return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; }
function write(p, txt){ fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, txt, 'utf8'); }

const ROOT = process.cwd();

function patchHeader(){
  const p = path.join(ROOT, 'src', 'components', 'ui', 'Header.jsx');
  let txt = read(p);
  if (!txt) { console.log('[skip] ui/Header.jsx not found'); return; }

  // Try to add a Words item next to Translate/Word Order in the dropdown menu.
  if (/onClick=\{\(\)=>onNav\('words'\)\}/.test(txt)) {
    console.log('[skip] Header already has Words menu');
    return;
  }

  // Insert after a Translate item if found
  let replaced = false;
  txt = txt.replace(/(onClick=\{\(\)=>onNav\('translate'\)\}[^>]*>[^<]*<\/[^>]+>)/, (m)=>{
    replaced = true;
    return m + `
            <a role="menuitem" className="menu-item" onClick={()=>onNav('words')}>Words</a>`;
  });

  if (!replaced) {
    // Insert after a Word Order item if found
    txt = txt.replace(/(onClick=\{\(\)=>onNav\('word-order'\)\}[^>]*>[^<]*<\/[^>]+>)/, (m)=>{
      replaced = true;
      return m + `
            <a role="menuitem" className="menu-item" onClick={()=>onNav('words')}>Words</a>`;
    });
  }

  if (!replaced) {
    // Fallback: append a block before closing menu container
    txt = txt.replace(/(<\/div>\s*<\/div>\s*<\/header>)/, `
            <a role="menuitem" className="menu-item" onClick={()=>onNav('words')}>Words</a>
        $1`);
  }

  write(p, txt);
  console.log('[done] Header.jsx patched with Words menu item');
}

function patchHome(){
  const p = path.join(ROOT, 'src', 'components', 'Home.jsx');
  let txt = read(p);
  if (!txt) { console.log('[skip] Home.jsx not found'); return; }

  if (/onClick=\{\(\)=>onNav\('words'\)\}/.test(txt)) {
    console.log('[skip] Home already links to Words');
    return;
  }

  // Try to insert next to Translate button
  let replaced = false;
  txt = txt.replace(/(<Button[^>]*onClick=\{\(\)=>onNav\('translate'\)\}[^>]*>[\s\S]*?<\/Button>)/, (m)=>{
    replaced = true;
    return m + `
        <Button className="ghost" onClick={()=>onNav('words')}>Words</Button>`;
  });

  if (!replaced) {
    // Fallback: insert before closing main container
    txt = txt.replace(/(<\/CardBody>\s*<\/Card>)/, `
        <div className="mt-16"><Button className="ghost" onClick={()=>onNav('words')}>Words</Button></div>
      $1`);
  }

  write(p, txt);
  console.log('[done] Home.jsx patched with Words button');
}

function patchStudyShell(){
  const p = path.join(ROOT, 'src', 'components', 'StudyShell.jsx');
  const txt = read(p);
  if (!txt) { console.log('[skip] StudyShell.jsx not found'); return; }
  if (/value:'words'/.test(txt)) { console.log('[skip] StudyShell already has Words tab'); return; }
  const newTxt = txt.replace(
    "{label:'Word Order', value:'word-order'}",
    "{label:'Word Order', value:'word-order'},\n    {label:'Words', value:'words'}"
  );
  if (newTxt !== txt) {
    write(p, newTxt);
    console.log('[done] StudyShell.jsx patched with Words tab');
  } else {
    console.log('[warn] Could not find tab items to patch in StudyShell.jsx');
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
    console.log('[ok] App.jsx: imported Words');
  }

  if (!/mode === 'words'/.test(txt)){
    txt = txt.replace(
      "{mode === 'word-order' && <WordOrderGame user={user} />}",
      "{mode === 'word-order' && <WordOrderGame user={user} />}\n      {mode === 'words' && <Words user={user} />}"
    );
    console.log('[ok] App.jsx: added words route');
  }

  write(p, txt);
  console.log('[done] App.jsx patched');
}

(function main(){
  console.log('Applying Words navigation patch...');
  patchHeader();
  patchHome();
  patchStudyShell();
  patchApp();
  console.log('All set.');
})();
