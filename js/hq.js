// Headquarters: the commander levels up on his own with every habit the player builds,
// across all the dimensions (COMMAND_RANKS gives the habits each rank needs).
import { REGIONS, CHARACTERS, COMMAND_RANKS } from './content.js';
import { habitsBuilt } from './engine.js';

export const homePlaces = () => REGIONS.filter((r) => r.characterId);

export function commander(s) {
  const places = homePlaces();
  const opened = places.filter((r) => s.regions?.[r.id]);
  const chars = CHARACTERS.filter((c) => s.characters?.[c.id]).map((c) => ({ def: c, ch: s.characters[c.id] }));
  const built = habitsBuilt(s);
  let ri = 0; COMMAND_RANKS.forEach(([need], i) => { if (built >= need) ri = i; });
  const next = COMMAND_RANKS[ri + 1], from = COMMAND_RANKS[ri][0];
  return {
    level: ri + 1, rank: COMMAND_RANKS[ri][1], rankIndex: ri, habits: built,
    nextRank: next?.[1] || null, nextAt: next?.[0] || null, toNext: next ? next[0] - built : 0,
    rankProgress: next ? (built - from) / (next[0] - from) : 1,
    opened, places, chars,
  };
}
