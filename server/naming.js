// Naming template engine. Tokens are Sonarr/Radarr style:
//   {Movie Title}  {Year}  {Quality Full}  {Resolution}
//   {MediaInfo VideoCodec}  {MediaInfo AudioCodec}  {Edition Tags}
//   {Series Title}  {season:00}  {episode:00}  {Episode Title}
//
// Values are sanitised to be filesystem-safe.

const INVALID_CHARS = /[\\/:*?"<>|\x00-\x1f]/g;

export function sanitise(v) {
  if (v == null) return '';
  return String(v).replace(INVALID_CHARS, '').replace(/\s+/g, ' ').trim();
}

function qualityFull(media) {
  const parts = [];
  if (media.source) parts.push(media.source);
  if (media.resolution || media.quality) parts.push(media.resolution || media.quality);
  return parts.filter(Boolean).join('-');
}

function buildTokens({ movie, series, episode, season_number, episode_number }) {
  const tokens = {};
  if (movie) {
    tokens['{Movie Title}'] = sanitise(movie.title);
    tokens['{Year}'] = movie.year ? String(movie.year) : '';
    tokens['{Quality Full}'] = sanitise(qualityFull(movie));
    tokens['{Quality Title}'] = sanitise(movie.quality || '');
    tokens['{Resolution}'] = sanitise(movie.resolution || '');
    tokens['{MediaInfo VideoCodec}'] = sanitise(movie.video_codec || '');
    tokens['{MediaInfo AudioCodec}'] = sanitise(movie.audio_codec || '');
    tokens['{Edition Tags}'] = sanitise(movie.edition || '');
  }
  if (series) {
    tokens['{Series Title}'] = sanitise(series.title);
  }
  if (episode) {
    tokens['{Episode Title}'] = sanitise(episode.title || '');
    tokens['{Quality Full}'] = sanitise(qualityFull(episode));
    tokens['{Resolution}'] = sanitise(episode.resolution || '');
    tokens['{MediaInfo VideoCodec}'] = sanitise(episode.video_codec || '');
    tokens['{MediaInfo AudioCodec}'] = sanitise(episode.audio_codec || '');
  }
  const s = season_number ?? episode?.season_number;
  const e = episode_number ?? episode?.episode_number;
  if (s != null) {
    tokens['{season}'] = String(s);
    tokens['{season:00}'] = String(s).padStart(2, '0');
  }
  if (e != null) {
    tokens['{episode}'] = String(e);
    tokens['{episode:00}'] = String(e).padStart(2, '0');
  }
  return tokens;
}

function renderTemplate(template, tokens) {
  let out = template;
  for (const [k, v] of Object.entries(tokens)) {
    out = out.split(k).join(v);
  }
  // Strip any unreplaced {…} leftovers
  out = out.replace(/\{[^}]+\}/g, '');
  // Collapse repeated separators from empty tokens
  out = out.replace(/\s+/g, ' ').replace(/\s*-\s*-\s*/g, ' - ').trim();
  // Remove trailing separators like " - " or " ("
  out = out.replace(/[\s\-_(\[]+$/g, '').trim();
  return out;
}

export function renderMovieFilename(template, movie) {
  const tokens = buildTokens({ movie });
  return renderTemplate(template, tokens);
}

export function renderMovieFolder(movie) {
  const year = movie.year ? ` (${movie.year})` : '';
  return `${sanitise(movie.title)}${year}`;
}

export function renderEpisodeFilename(template, { series, episode, season_number, episode_number }) {
  const tokens = buildTokens({ series, episode, season_number, episode_number });
  return renderTemplate(template, tokens);
}

export function renderSeriesFolder(series) {
  const year = series.year ? ` (${series.year})` : '';
  return `${sanitise(series.title)}${year}`;
}

export function renderSeasonFolder(season_number) {
  if (season_number == null) return 'Specials';
  if (Number(season_number) === 0) return 'Specials';
  return `Season ${String(season_number).padStart(2, '0')}`;
}
