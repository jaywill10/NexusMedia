// Release-name / filename parser.
// Extracts: title, year, season/episode, quality, source, codec, audio codec.

const VIDEO_EXTS = new Set([
  '.mkv', '.mp4', '.avi', '.m4v', '.mov', '.wmv', '.flv', '.ts', '.m2ts', '.webm',
]);

export function isVideoFile(filename) {
  const i = filename.lastIndexOf('.');
  if (i < 0) return false;
  return VIDEO_EXTS.has(filename.slice(i).toLowerCase());
}

export function parseRelease(name) {
  const out = {
    title: null,
    year: null,
    season_number: null,
    episode_number: null,
    resolution: null,
    source: null,
    video_codec: null,
    audio_codec: null,
    quality: null,
    edition: null,
  };

  // Strip extension
  let base = name.replace(/\.[a-z0-9]{2,4}$/i, '');

  // Normalise separators
  const norm = base.replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim();

  // Resolution
  const resM = /\b(2160p|1080p|720p|576p|480p)\b/i.exec(norm);
  if (resM) out.resolution = resM[1].toLowerCase();

  // Source
  const srcPatterns = [
    [/\bREMUX\b/i, 'REMUX'],
    [/\bBluRay\b|\bBlu-Ray\b|\bBDRip\b|\bBRRip\b/i, 'BluRay'],
    [/\bWEB-?DL\b|\bWEBDL\b/i, 'WEB-DL'],
    [/\bWEB-?Rip\b|\bWEBRip\b/i, 'WEBRip'],
    [/\bHDTV\b/i, 'HDTV'],
    [/\bDVDRip\b/i, 'DVDRip'],
  ];
  for (const [re, label] of srcPatterns) {
    if (re.test(norm)) { out.source = label; break; }
  }

  // Video codec
  const vcM = /\b(x264|x265|h\.?264|h\.?265|HEVC|AVC|XviD|DivX)\b/i.exec(norm);
  if (vcM) {
    const raw = vcM[1].toLowerCase().replace(/\./g, '');
    if (raw === 'h264' || raw === 'avc') out.video_codec = 'x264';
    else if (raw === 'h265' || raw === 'hevc') out.video_codec = 'x265';
    else out.video_codec = vcM[1];
  }

  // Audio codec
  const acM = /\b(DTS-HD(?:\sMA)?|DTS-X|DTS|TrueHD|Atmos|DDP?[57]?\.?1|AC3|AAC|FLAC|OPUS|MP3)\b/i.exec(norm);
  if (acM) out.audio_codec = acM[1];

  // Edition tags
  const edM = /\b(Extended|Directors?[\s.']Cut|Unrated|Theatrical|Remastered|IMAX|Criterion)\b/i.exec(norm);
  if (edM) out.edition = edM[1];

  // Season / Episode: S01E02, 1x02, Season 1 Episode 2, S01, S01E02E03
  const seM = /\bS(\d{1,2})[\s.-]?E(\d{1,3})(?:[\s.-]?E(\d{1,3}))?\b/i.exec(norm);
  const altM = /\b(\d{1,2})x(\d{1,3})\b/.exec(norm);
  const seasonOnlyM = /\bS(\d{1,2})\b(?!E)/i.exec(norm);
  if (seM) {
    out.season_number = parseInt(seM[1], 10);
    out.episode_number = parseInt(seM[2], 10);
  } else if (altM) {
    out.season_number = parseInt(altM[1], 10);
    out.episode_number = parseInt(altM[2], 10);
  } else if (seasonOnlyM) {
    out.season_number = parseInt(seasonOnlyM[1], 10);
  }

  // Year
  const yrM = /\b(19\d{2}|20\d{2})\b/.exec(norm);
  if (yrM) out.year = parseInt(yrM[1], 10);

  // Title — take everything before the first "signal" token
  // (year / SxxExx / resolution / source / common group prefix)
  let endIdx = norm.length;
  const signalMatches = [
    yrM, seM, altM, seasonOnlyM, resM,
    /\bBluRay|BRRip|BDRip|WEB-?DL|WEBRip|HDTV|DVDRip|REMUX\b/i.exec(norm),
    /\b(x264|x265|h\.?264|h\.?265|HEVC|AVC)\b/i.exec(norm),
  ].filter(Boolean);
  for (const m of signalMatches) {
    if (m.index < endIdx) endIdx = m.index;
  }
  out.title = norm.slice(0, endIdx).trim().replace(/[-_\s]+$/g, '').trim() || null;

  // Derived quality label: "{source}-{resolution}" like Radarr
  if (out.source && out.resolution) out.quality = `${out.source}-${out.resolution}`;
  else if (out.resolution) out.quality = out.resolution;
  else if (out.source) out.quality = out.source;

  return out;
}
