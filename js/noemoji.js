// No face emoji in the game (the other emoji stay): faces are taken out of the page's text
// as it appears, and out of the text drawn on 3D labels.
const FACE = /(?:[\u{1F600}-\u{1F644}\u{1F910}-\u{1F92F}\u{1F970}-\u{1F97A}\u{1F9D0}\u{1FAE0}-\u{1FAE8}\u{263A}\u{2639}\u{1F47F}\u{1F608}\u{1F925}\u{1F974}][\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]*)+[  ]?/gu;
export const noEmoji = (s) => (typeof s === 'string' ? s.replace(FACE, '') : s);

const clean = (n) => { if (n.nodeType === 3) { const v = noEmoji(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; return; } const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT); for (let t = w.nextNode(); t; t = w.nextNode()) { const v = noEmoji(t.nodeValue); if (v !== t.nodeValue) t.nodeValue = v; } };
export function watchNoEmoji(root = document.body) {
  clean(root);
  new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'characterData') clean(m.target); else m.addedNodes.forEach(clean); } })
    .observe(root, { subtree: true, childList: true, characterData: true });
}
