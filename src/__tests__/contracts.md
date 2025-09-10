# API Contract Notes

- `/api/glossary` -> `{ ok, source, semesters:[{id,name,units:[{id,name,chapters:[{id,name}]}]}] }`
- `/api/sentence-bundle` -> `{ ok, prompt, answer, direction, difficulty, tokens }`
- `/api/grade` -> `{ ok, score, feedback }`
