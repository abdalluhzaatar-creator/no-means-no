// Headquarters: the commander levels up on his own from the player's progress.
// Level = 1 + 2 per place opened after the first + 1 per character level gained.
import { REGIONS, CHARACTERS, COMMAND_RANKS } from './content.js';

export const homePlaces = () => REGIONS.filter((r) => r.characterId);

export function commander(s) {
  const places = homePlaces();
  const opened = places.filter((r) => s.regions?.[r.id]);
  const chars = CHARACTERS.filter((c) => s.characters?.[c.id]).map((c) => {
    const ch = s.characters[c.id];
    const gained = (ch.stage || 0) * 5 + (ch.level || 1) - 1;
    return { def: c, ch, gained };
  });
  const fromPlaces = Math.max(0, opened.length - 1) * 2;
  const fromChars = chars.reduce((a, c) => a + c.gained, 0);
  const level = 1 + fromPlaces + fromChars;
  let ri = 0;
  COMMAND_RANKS.forEach(([min], i) => { if (level >= min) ri = i; });
  const next = COMMAND_RANKS[ri + 1];
  const cur = COMMAND_RANKS[ri][0];
  return {
    level, rank: COMMAND_RANKS[ri][1], rankIndex: ri,
    nextRank: next?.[1] || null, toNext: next ? next[0] - level : 0,
    rankProgress: next ? (level - cur) / (next[0] - cur) : 1,
    opened, places, chars, fromPlaces, fromChars,
  };
}
