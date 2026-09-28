// Headquarters: the commander levels up on his own from the player's progress.
// Every 3 keys collected raise him one rank.
export const KEYS_PER_RANK = 3;
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
  // Every KEYS_PER_RANK keys collected (ever) promote the commander by themselves.
  const earned = s.stats?.keysEarned || 0;
  const ri = Math.min(COMMAND_RANKS.length - 1, Math.floor(earned / KEYS_PER_RANK));
  const next = COMMAND_RANKS[ri + 1];
  const have = next ? earned - ri * KEYS_PER_RANK : KEYS_PER_RANK;
  return {
    level: ri + 1, rank: COMMAND_RANKS[ri][1], rankIndex: ri, keysEarned: earned,
    nextRank: next?.[1] || null, toNext: next ? KEYS_PER_RANK - have : 0, keysInRank: have,
    rankProgress: have / KEYS_PER_RANK,
    opened, places, chars, fromPlaces, fromChars,
  };
}
