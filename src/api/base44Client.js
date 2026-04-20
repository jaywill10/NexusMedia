// Local replacement for the Base44 SDK.
// Exposes the same shape the rest of the frontend expects:
//   base44.auth.{me, logout, redirectToLogin}
//   base44.entities.<Name>.{list, filter, create, update, delete, get}

const ENTITY_NAMES = [
  'AppSettings',
  'BlocklistEntry',
  'CustomFormat',
  'DownloadClient',
  'DownloadQueueItem',
  'Episode',
  'HealthIssue',
  'HistoryEvent',
  'Indexer',
  'Movie',
  'NotificationRule',
  'QualityProfile',
  'RemotePathMap',
  'Request',
  'RootFolder',
  'SearchResult',
  'Season',
  'Series',
  'Tag',
  'UserProfile',
];

async function api(path, { method = 'GET', body, signal, query } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const qs = query ? buildQuery(query) : '';
  const res = await fetch(`/api${path}${qs}`, {
    method,
    credentials: 'include',
    headers,
    body: body == null ? undefined : JSON.stringify(body),
    signal,
  });
  if (res.status === 204) return null;
  const contentType = res.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const err = new Error(payload?.error || res.statusText);
    err.status = res.status;
    err.data = payload;
    throw err;
  }
  return payload;
}

function entity(name) {
  const base = `/entities/${name}`;
  return {
    async list(sort, limit) {
      return api(base + buildQuery({ sort, limit }));
    },
    async filter(filter, sort, limit) {
      return api(`${base}/query`, {
        method: 'POST',
        body: { filter, sort, limit },
      });
    },
    async get(id) {
      return api(`${base}/${encodeURIComponent(id)}`);
    },
    async create(data) {
      return api(base, { method: 'POST', body: data });
    },
    async update(id, data) {
      return api(`${base}/${encodeURIComponent(id)}`, { method: 'PATCH', body: data });
    },
    async delete(id) {
      return api(`${base}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
  };
}

function buildQuery(params) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v == null) continue;
    s.set(k, String(v));
  }
  const q = s.toString();
  return q ? `?${q}` : '';
}

const entities = Object.fromEntries(ENTITY_NAMES.map((n) => [n, entity(n)]));

const auth = {
  async me() {
    return api('/auth/me');
  },
  async login(email, password) {
    return api('/auth/login', { method: 'POST', body: { email, password } });
  },
  async register(payload) {
    return api('/auth/register', { method: 'POST', body: payload });
  },
  async logout() {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
  },
  redirectToLogin(fromUrl) {
    const from = encodeURIComponent(fromUrl || window.location.href);
    window.location.assign(`/login?from=${from}`);
  },
  async setupState() {
    return api('/auth/setup');
  },
};

const tmdb = {
  status: () => api('/tmdb/status'),
  setApiKey: (api_key) => api('/tmdb/api-key', { method: 'POST', body: { api_key } }),
  clearApiKey: () => api('/tmdb/api-key', { method: 'DELETE' }),
  genres: () => api('/tmdb/genres'),
  discover: (params) => api('/tmdb/discover', { query: params }),
  search: (params) => api('/tmdb/search', { query: params }),
  movie: (tmdbId) => api(`/tmdb/movie/${encodeURIComponent(tmdbId)}`),
  series: (tmdbId) => api(`/tmdb/series/${encodeURIComponent(tmdbId)}`),
};

export const base44 = { auth, entities, tmdb };
export default base44;
