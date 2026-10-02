// Headquarters: the commander's rank follows the whole journey. Every step counts —
// each dimension opened (after the first) and each rank a character gains — and the
// top rank (فريق) comes only when every dimension is open and every character is at
// the last rank. The steps are spread evenly over the commander ranks.
import { REGIONS, CHARACTERS, COMMAND_RANKS, RANKS } from './content.js';

export const homePlaces = () => REGIONS.filter((r) => r.characterId);
// Steps in the whole game: 7 dimensions to open + 11 ranks for each of the 8 characters.
const dimChars = () => CHARACTERS.filter((c) => c.stages && homePlaces().some((r) => r.characterId === c.id));
export const TOTAL_STEPS = homePlaces().length - 1 + dimChars().length * (RANKS.length - 1);
// Steps needed for commander rank i (0 = جندي … last = فريق at every step done).
export const stepsFor = (i) => Math.round((i * TOTAL_STEPS) / (COMMAND_RANKS.length - 1));

export function commander(s) {
  const places = homePlaces();
  const opened = places.filter((r) => s.regions?.[r.id]);
  const chars = dimChars().filter((c) => s.characters?.[c.id]).map((c) => {
    const ch = s.characters[c.id];
    const gained = Math.min(RANKS.length - 1, (ch.stage || 0) * 5 + (ch.level || 1) - 1);
    return { def: c, ch, gained };
  });
  const fromPlaces = Math.max(0, opened.length - 1);
  const fromChars = chars.reduce((a, c) => a + c.gained, 0);
  const steps = Math.min(TOTAL_STEPS, fromPlaces + fromChars);
  let ri = 0;
  COMMAND_RANKS.forEach((_, i) => { if (steps >= stepsFor(i)) ri = i; });
  const next = COMMAND_RANKS[ri + 1];
  const from = stepsFor(ri), to = next ? stepsFor(ri + 1) : TOTAL_STEPS;
  return {
    level: ri + 1, rank: COMMAND_RANKS[ri][1], rankIndex: ri, steps, total: TOTAL_STEPS,
    nextRank: next?.[1] || null, toNext: next ? to - steps : 0, stepsInRank: steps - from, stepsPerRank: to - from,
    rankProgress: next ? (steps - from) / (to - from) : 1,
    opened, places, chars, fromPlaces, fromChars,
  };
}
