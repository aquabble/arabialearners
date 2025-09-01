# All fixes applied
- Visual overhaul (cards, tabs, hero, theme) — `src/styles/ui.css`, new UI components
- React plugin + automatic JSX — `vite.config.js`
- Favicon added — `public/favicon.png` (+ ICO), linked in `index.html`
- COOP header for OAuth popups — `public/_headers` and `vercel.json`
- Firebase dev rules — `firebase/firestore.rules`, `firebase/storage.rules`
- Auth guard helper — `src/lib/firebase-guard.js`

## Next steps
npm i
npm i -D @vitejs/plugin-react
npm run dev

For Firebase:
firebase deploy --only firestore:rules,storage:rules
Add your domain(s) in Firebase Console → Auth → Settings → Authorized domains.
