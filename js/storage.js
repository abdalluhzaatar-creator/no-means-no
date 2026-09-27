// Save/load. Cloud mode: the page is hosted as a claude.ai Artifact, the viewer's
// claude.ai account is the user account, and the save lives in the artifact's
// cloud database under that user's private path. Local mode (file opened
// directly): a simple named profile in localStorage.

const LOCAL_PREFIX = 'nmn.save.';
const LOCAL_LAST = 'nmn.lastProfile';

const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };

async function connectCloud() {
  // The host injects window.claude shortly after load; give it a moment.
  for (let i = 0; i < 15 && !window.claude?.use; i++) await new Promise((r) => setTimeout(r, 100));
  if (!window.claude?.use) return null;
  const timeout = new Promise((r) => setTimeout(() => r(null), 8000));
  const [db, user] = await Promise.race([
    Promise.all([window.claude.use('db'), window.claude.use('user')]),
    timeout.then(() => [null, null]),
  ]);
  if (!db || !user) return null;
  const me = await user.me();
  if (!me?.id) return null;
  return { db, id: me.id, name: me.name || '' };
}

export async function createStorage() {
  const cloud = await connectCloud().catch(() => null);

  if (cloud) {
    const ref = cloud.db.doc(`data/users/${cloud.id}/save`);
    return {
      mode: 'cloud',
      accountName: cloud.name,
      needsLogin: false,
      async load() {
        const snap = await ref.get();
        const d = snap.exists ? snap.data() : null;
        return d?.json ? JSON.parse(d.json) : null;
      },
      async save(state) {
        await ref.set({ json: JSON.stringify(state), updatedAt: Date.now() });
      },
      async reset() { await ref.delete(); },
    };
  }

  let profile = safe(() => localStorage.getItem(LOCAL_LAST));
  return {
    mode: 'local',
    get accountName() { return profile; },
    get needsLogin() { return !profile; },
    profiles: () => safe(() => Object.keys(localStorage).filter((k) => k.startsWith(LOCAL_PREFIX)).map((k) => k.slice(LOCAL_PREFIX.length)), []),
    login(name) { profile = name.trim(); safe(() => localStorage.setItem(LOCAL_LAST, profile)); },
    logout() { profile = null; safe(() => localStorage.removeItem(LOCAL_LAST)); },
    async load() {
      const raw = safe(() => localStorage.getItem(LOCAL_PREFIX + profile));
      return raw ? JSON.parse(raw) : null;
    },
    async save(state) { safe(() => localStorage.setItem(LOCAL_PREFIX + profile, JSON.stringify(state))); },
    async reset() { safe(() => localStorage.removeItem(LOCAL_PREFIX + profile)); },
  };
}
