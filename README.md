# LostLink

A responsive React/Vite starter for an AI-assisted lost-and-found platform. The UI runs in demo mode without credentials. Supabase features become available after configuration.

## Requirements
- Node.js 20+ (recommended)
- npm
- A Supabase project (optional for demo mode)
- Gemini API key (optional; rule-based matching works without it)

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Open the Vite URL shown in your terminal (usually `http://localhost:5173`).

In a second terminal, run the optional AI API:

```bash
npm run server
```

API health endpoint: `http://localhost:8787/api/health`

## Supabase setup
1. Create a project in Supabase.
2. Open SQL Editor and run `supabase/schema.sql`.
3. In Project Settings → API, copy the Project URL and anon/publishable key into `.env`.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Restart Vite after changing environment variables.

The current React starter supports Supabase email/password sign-in and saves report rows to `lost_items` / `found_items` when configured. Demo mode uses in-memory sample records. Some advanced screens (full claim review, handover scheduling, image uploads, and admin actions) are UI scaffolds and require production API/policy wiring.

## AI matching API
Add `GEMINI_API_KEY` to `.env`. Never prefix it with `VITE_`. Run `npm run server`; send POST requests to `/api/match-analysis` with JSON:
```json
{
  "lostItem": {"category":"Wallet","name":"Black wallet","description":"Leather wallet","location":"Library","date":"2026-10-07"},
  "foundItem": {"category":"Wallet","name":"Dark wallet","description":"Wallet found by library","location":"Library entrance","date":"2026-10-07"}
}
```
If the key is missing or the AI call fails, the API returns a rule-based fallback. The server is advisory only and never accepts private ownership answers.

## Deployment
### Frontend
1. Push the project to GitHub.
2. Import the repository in Vercel.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to Vercel project environment variables.
4. Deploy.

### API
Deploy `server/` as a separate Node service (for example, Render) or adapt it to a Vercel serverless function. Set `GEMINI_API_KEY`, `CLIENT_ORIGIN`, and `PORT` as appropriate. Update the frontend to call your deployed API endpoint before using AI analysis.

## Security notes before real deployment
- This is a student-project starter, not a fully audited production service.
- Do not expose Supabase service-role keys or Gemini keys in browser code.
- Keep `lost_item_private` inaccessible to public clients. In a production system, even owners' private answers should be compared in a server-side function without returning the stored answers to a claimant.
- The current claim form is an evidence-submission workflow; it is not a completed ownership verification algorithm.
- The Admin page is a demo UI. Enforce admin roles server-side/RLS before production use.
- Create a private `item-photos` bucket and a separate private evidence bucket with strict Storage policies.
- Use official campus Lost & Found/security desks for handovers; never release items automatically based on an AI score.
- Sample listings are mock data and should be removed or labeled clearly in a real deployment.

## Project structure
- `src/App.jsx` — modular page components and flows
- `src/styles.css` — responsive light theme
- `src/lib/matching.js` — local fallback scoring
- `src/lib/supabase.js` — Supabase client
- `server/index.js` — Gemini API proxy with fallback scoring
- `supabase/schema.sql` — tables and RLS starter policies
