const words = (value = '') => new Set(value.toLowerCase().match(/[a-z0-9]+/g) || []);
const overlap = (a, b) => {
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return 0;
  const common = [...A].filter(x => B.has(x)).length;
  return Math.round(100 * common / new Set([...A, ...B]).size);
};

export function scoreMatch(lost, found) {
  const categorySimilarity = lost.category === found.category ? 100 : 0;
  const descriptionSimilarity = overlap(
    `${lost.name || ''} ${lost.description || ''} ${lost.color || ''} ${lost.brand || ''}`,
    `${found.name || ''} ${found.description || ''} ${found.color || ''} ${found.brand || ''}`
  );
  const locationSimilarity = overlap(lost.location, found.location);
  const days = Math.abs(new Date(lost.date || Date.now()) - new Date(found.date || Date.now())) / 86400000;
  const timeSimilarity = Math.max(0, Math.round(100 - days * 8));
  const overallConfidence = Math.round(
    categorySimilarity * .3 + descriptionSimilarity * .35 +
    locationSimilarity * .2 + timeSimilarity * .15
  );
  return {
    categorySimilarity, descriptionSimilarity, locationSimilarity, timeSimilarity,
    overallConfidence,
    reasons: [
      categorySimilarity ? 'The item categories match.' : 'The categories differ.',
      `Description keyword similarity is ${descriptionSimilarity}%.`,
      `Location keyword similarity is ${locationSimilarity}%.`,
      `Date proximity score is ${timeSimilarity}%.`
    ],
    needsManualReview: overallConfidence >= 55
  };
}

export function findMatches(item, items, kind) {
  return items
    .filter(candidate => candidate.status === 'open' && candidate.id !== item.id)
    .map(candidate => ({
      item: candidate,
      score: kind === 'lost'
        ? scoreMatch(item, candidate)
        : scoreMatch(candidate, item)
    }))
    .filter(match => match.score.overallConfidence >= 25)
    .sort((a, b) => b.score.overallConfidence - a.score.overallConfidence)
    .slice(0, 5);
}