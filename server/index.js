import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok:true, service:'LostLink API' }));

// AI is advisory only. Never send private ownership answers to this endpoint.
app.post('/api/match-analysis', async (req, res) => {
  const { lostItem, foundItem } = req.body || {};
  if (!lostItem || !foundItem || typeof lostItem !== 'object' || typeof foundItem !== 'object') {
    return res.status(400).json({ error:'lostItem and foundItem objects are required.' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.json({ source:'fallback', ...fallbackScore(lostItem, foundItem) });
  }

  try {
    const prompt = `Compare these public lost/found item descriptions. Do not infer ownership and do not use or request private ownership data. Return JSON only with categorySimilarity, descriptionSimilarity, locationSimilarity, timeSimilarity, overallConfidence (all 0-100), reasons (string array), needsManualReview (boolean). A high score is only a possible match, never proof of ownership. Lost: ${JSON.stringify(publicFields(lostItem))}. Found: ${JSON.stringify(publicFields(foundItem))}.`;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ contents:[{ parts:[{ text:prompt }] }], generationConfig:{ responseMimeType:'application/json', temperature:0.1 } })
    });
    if (!response.ok) throw new Error('AI provider request failed');
    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.map(p=>p.text || '').join('');
    const parsed = JSON.parse(raw || '{}');
    return res.json({ source:'gemini', ...sanitizeScore(parsed) });
  } catch {
    return res.json({ source:'fallback', ...fallbackScore(lostItem, foundItem) });
  }
});

function publicFields(item) {
  return {
    category:String(item.category || '').slice(0,80),
    name:String(item.name || '').slice(0,100),
    description:String(item.description || '').slice(0,1000),
    location:String(item.location || '').slice(0,200),
    date:String(item.date || '').slice(0,30),
    color:String(item.color || '').slice(0,50),
    brand:String(item.brand || '').slice(0,80)
  };
}
function sanitizeScore(x) {
  const num = n => Math.max(0, Math.min(100, Number(n) || 0));
  return {
    categorySimilarity:num(x.categorySimilarity),
    descriptionSimilarity:num(x.descriptionSimilarity),
    locationSimilarity:num(x.locationSimilarity),
    timeSimilarity:num(x.timeSimilarity),
    overallConfidence:num(x.overallConfidence),
    reasons:Array.isArray(x.reasons) ? x.reasons.slice(0,6).map(v=>String(v).slice(0,250)) : [],
    needsManualReview:true
  };
}
function tokens(s='') { return new Set(String(s).toLowerCase().match(/[a-z0-9]+/g) || []); }
function similarity(a,b) {
  const A=tokens(a), B=tokens(b);
  if (!A.size || !B.size) return 0;
  return Math.round(100 * [...A].filter(x=>B.has(x)).length / new Set([...A,...B]).size);
}
function fallbackScore(lost, found) {
  const categorySimilarity = String(lost.category || '').toLowerCase() === String(found.category || '').toLowerCase() ? 100 : 0;
  const descriptionSimilarity = similarity(`${lost.name||''} ${lost.description||''} ${lost.color||''} ${lost.brand||''}`, `${found.name||''} ${found.description||''} ${found.color||''} ${found.brand||''}`);
  const locationSimilarity = similarity(lost.location, found.location);
  const delta = Math.abs(new Date(lost.date || Date.now()) - new Date(found.date || Date.now())) / 86400000;
  const timeSimilarity = Number.isFinite(delta) ? Math.max(0, Math.round(100 - delta * 8)) : 0;
  const overallConfidence = Math.round(categorySimilarity*.3 + descriptionSimilarity*.35 + locationSimilarity*.2 + timeSimilarity*.15);
  return { categorySimilarity, descriptionSimilarity, locationSimilarity, timeSimilarity, overallConfidence,
    reasons:['Rule-based fallback matching is active.','This is a possible match, not proof of ownership.'], needsManualReview:true };
}

const port = Number(process.env.PORT || 8787);
app.listen(port, () => console.log(`LostLink API running at http://localhost:${port}`));