const fs = require('fs')
const path = require('path')

function projectRoot(){
  return process.cwd()
}

function loadJSONSync(p){
  const txt = fs.readFileSync(p, 'utf8')
  return JSON.parse(txt)
}

// Single Source of Truth: src/lib/Glossary.json
function loadGlossary(){
  const root = projectRoot()
  const candidates = [
    path.join(root, 'src', 'lib', 'Glossary.json'),
    path.join(root, 'api', 'Glossary.json'),
    path.join(__dirname, 'Glossary.json')
  ]
  for(const p of candidates){
    if (fs.existsSync(p)){
      const data = loadJSONSync(p)
      // file is an array with type Glossary at [0]
      const gloss = Array.isArray(data) ? data.find(x => x && x.type === 'Glossary') : data
      return gloss || data
    }
  }
  throw new Error('Glossary not found')
}

function getSemestersList(gloss){
  if (!gloss) return []
  const list = gloss.semesters || []
  return Array.isArray(list) ? list : []
}

// Normalizes to { semesters:[{id,name,units:[{id,name,chapters:[{id,name}]}]}] ] }
function normalizeGlossaryForUI(gloss){
  const semesters = getSemestersList(gloss).map(s => ({
    id: s?.id, name: s?.name,
    units: (s?.units||[]).map(u => ({
      id: u?.id, name: u?.name,
      chapters: (u?.chapters||[]).map(c => ({ id: c?.id, name: c?.name }))
    }))
  }))
  return { semesters }
}

module.exports = {
  loadGlossary,
  getSemestersList,
  normalizeGlossaryForUI
}
