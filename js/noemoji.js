// The game shows no emoji: every emoji (with its joiners, skin tones, keycaps) is taken out
// of the page's text as it appears, and out of the text drawn on 3D labels.
const RUN = /(?:[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}][\u{FE0F}\u{FE0E}\u{200D}\u{20E3}\u{1F3FB}-\u{1F3FF}]*)+[  ]?/gu;
const ANY = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]/u;
export const noEmoji = (s) => (typeof s === 'string' && ANY.test(s) ? s.replace(RUN, '').replace(/️/g, '') : s);

const clean = (n) => { if (n.nodeType === 3) { const v = noEmoji(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; return; } const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT); for (let t = w.nextNode(); t; t = w.nextNode()) { const v = noEmoji(t.nodeValue); if (v !== t.nodeValue) t.nodeValue = v; } };
export function watchNoEmoji(root = document.body) {
  clean(root);
  new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'characterData') clean(m.target); else m.addedNodes.forEach(clean); } })
    .observe(root, { subtree: true, childList: true, characterData: true });
}
