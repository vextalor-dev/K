// ============================================================
// K - client config
// VidKing embed URL builders + shared constants
// ============================================================

export const APP_NAME = 'K';

// K TV Android APK — now delivered via GitHub Releases (see .github/workflows/build-apk.yml)
// Falls back to /apk/app-release.apk for local dev where the artifact is placed manually.
// Version must stay in sync with tv-app/app/build.gradle versionName.
export const APK = {
  // Production: replace with latest release URL, e.g. https://github.com/vextalor-dev/K/releases/latest/download/app-release.apk
  url: '/apk/app-release.apk',
  fileName: 'app-release.apk',
  version: '1.0.1',
  savePath: '/storage/emulated/0/Download/',
  releaseUrl: 'https://github.com/vextalor-dev/K/releases/latest/download/app-release.apk',
};

export const VIDKING = {
  movie(id, opts = {}) {
    const p = new URLSearchParams({ color: 'dc2626', autoPlay: 'true' });
    if (opts.progress) p.set('progress', String(Math.floor(opts.progress)));
    return `https://www.vidking.net/embed/movie/${id}?${p.toString()}`;
  },
  tv(id, season, episode, opts = {}) {
    const p = new URLSearchParams({
      color: 'dc2626', autoPlay: 'true',
      nextEpisode: 'true', episodeSelector: 'true',
    });
    if (opts.progress) p.set('progress', String(Math.floor(opts.progress)));
    return `https://www.vidking.net/embed/tv/${id}/${season}/${episode}?${p.toString()}`;
  },
};

export const imgUrl = (path, size = 'w500') =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null;

export const trailerUrl = (key, { autoplay = false, controls = true } = {}) => {
  const p = new URLSearchParams({
    autoplay: autoplay ? '1' : '0', mute: autoplay ? '1' : '0',
    controls: controls ? '1' : '0', loop: autoplay ? '1' : '0',
    playlist: key, rel: '0', modestbranding: '1', playsinline: '1',
  });
  return `https://www.youtube-nocookie.com/embed/${key}?${p.toString()}`;
};

// Local subtitle manifest: TMDB tv id -> { season, episodes: { ep: '/subs/...srt' } }
// Files are voice-synced (official streaming release timings).
export const SUBTITLES = {
  229915: { // Night Has Come (2023)
    season: 1,
    episodes: {
      1: '/subs/night-has-come/s01e01.srt',
      2: '/subs/night-has-come/s01e02.srt',
      3: '/subs/night-has-come/s01e03.srt',
      4: '/subs/night-has-come/s01e04.srt',
      5: '/subs/night-has-come/s01e05.srt',
      6: '/subs/night-has-come/s01e06.srt',
      7: '/subs/night-has-come/s01e07.srt',
      8: '/subs/night-has-come/s01e08.srt',
      9: '/subs/night-has-come/s01e09.srt',
      10: '/subs/night-has-come/s01e10.srt',
      11: '/subs/night-has-come/s01e11.srt',
      12: '/subs/night-has-come/s01e12.srt',
    },
  },
};

export const ANIME_IDS = [
  { id: 37854, title: 'One Piece' },
  { id: 46260, title: 'Naruto' },
  { id: 1429, title: 'Attack on Titan' },
  { id: 95479, title: 'Jujutsu Kaisen' },
  { id: 85937, title: 'Demon Slayer' },
  { id: 65930, title: 'My Hero Academia' },
  { id: 5114, title: 'Fullmetal Alchemist: Brotherhood' },
  { id: 1255, title: 'Fullmetal Alchemist' },
  { id: 1422, title: 'Death Note' },
  { id: 61511, title: 'One Punch Man' },
  { id: 12971, title: 'Dragon Ball Z' },
  { id: 66025, title: 'Tokyo Ghoul' },
  { id: 114410, title: 'Chainsaw Man' },
  { id: 142202, title: 'Spy x Family' },
  { id: 267, title: 'Hunter x Hunter' },
  { id: 94997, title: 'Vinland Saga' },
  { id: 25327, title: 'Bleach' },
  { id: 45782, title: 'Sword Art Online' },
  { id: 31911, title: 'Steins;Gate' },
  { id: 15799, title: 'Code Geass' },
];

export const GENRES = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
  80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
  14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
  9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
  10762: 'Kids', 10765: 'Sci-Fi & Fantasy', 10764: 'Reality', 10759: 'Action & Adventure',
};

export const GENRE_MOODS = {
  28: 'Exciting', 12: 'Adventurous', 16: 'Charming', 35: 'Funny',
  80: 'Intense', 99: 'Informative', 18: 'Emotional', 10751: 'Feel-good',
  14: 'Fantastical', 36: 'Historical', 27: 'Scary', 10402: 'Musical',
  9648: 'Intriguing', 10749: 'Romantic', 878: 'Mind-bending',
  53: 'Suspenseful', 10752: 'War', 37: 'Western',
};

export const LANGUAGES = [
  { code: 'ko', label: 'Korean TV Shows', media: 'tv' },
  { code: 'ko', label: 'Korean Movies', media: 'movie' },
  { code: 'hi', label: 'Hindi TV Shows', media: 'tv' },
  { code: 'hi', label: 'Hindi Movies', media: 'movie' },
  { code: 'ja', label: 'Japanese TV Shows', media: 'tv' },
  { code: 'ja', label: 'Japanese Movies', media: 'movie' },
  { code: 'zh', label: 'Chinese TV Shows', media: 'tv' },
  { code: 'zh', label: 'Chinese Movies', media: 'movie' },
  { code: 'ta', label: 'Tamil Movies', media: 'movie' },
  { code: 'te', label: 'Telugu Movies', media: 'movie' },
  { code: 'th', label: 'Thai Movies', media: 'movie' },
  { code: 'id', label: 'Indonesian Movies', media: 'movie' },
];

export const BROWSE_GENRES = [
  { id: 28, label: 'Action' }, { id: 35, label: 'Comedy' },
  { id: 27, label: 'Horror' }, { id: 878, label: 'Sci-Fi' },
  { id: 18, label: 'Drama' }, { id: 10749, label: 'Romance' },
  { id: 80, label: 'Crime' }, { id: 99, label: 'Documentary' },
  { id: 16, label: 'Animation' }, { id: 14, label: 'Fantasy' },
  { id: 53, label: 'Thriller' }, { id: 10751, label: 'Family' },
  { id: 12, label: 'Adventure' }, { id: 10402, label: 'Music' },
  { id: 9648, label: 'Mystery' }, { id: 36, label: 'History' },
  { id: 10752, label: 'War' }, { id: 37, label: 'Western' },
];
