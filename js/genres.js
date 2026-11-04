// Common genres. Used for suggestions in the log form, and once, to move
// tags that are clearly genres into the separate genres field.
export const COMMON_GENRES = [
  'rock', 'pop', 'hip hop', 'rap', 'r&b', 'soul', 'funk', 'jazz', 'blues', 'country', 'folk',
  'electronic', 'house', 'techno', 'ambient', 'dance', 'disco', 'drum and bass', 'dubstep', 'uk garage',
  'trip hop', 'downtempo', 'idm', 'synth-pop', 'synthpop', 'new wave', 'post-punk', 'punk', 'punk rock',
  'hardcore', 'emo', 'metal', 'heavy metal', 'black metal', 'death metal', 'doom metal', 'sludge metal',
  'indie', 'indie rock', 'indie pop', 'indie folk', 'alternative', 'alternative rock', 'grunge',
  'shoegaze', 'dream pop', 'noise', 'noise rock', 'post-rock', 'math rock', 'art rock', 'art pop',
  'progressive rock', 'psychedelic', 'psychedelic rock', 'krautrock', 'garage rock', 'surf rock',
  'classic rock', 'hard rock', 'glam rock', 'soft rock', 'yacht rock', 'singer-songwriter',
  'americana', 'bluegrass', 'gospel', 'reggae', 'dub', 'ska', 'dancehall', 'reggaeton', 'latin',
  'bossa nova', 'samba', 'mpb', 'tropicália', 'salsa', 'cumbia', 'afrobeat', 'afrobeats', 'amapiano',
  'k-pop', 'j-pop', 'city pop', 'world', 'classical', 'contemporary classical', 'minimalism', 'opera',
  'baroque', 'soundtrack', 'film score', 'experimental', 'avant-garde', 'free jazz', 'jazz fusion',
  'spiritual jazz', 'hard bop', 'bebop', 'cool jazz', 'vocal jazz', 'neo-soul', 'contemporary r&b',
  'trap', 'drill', 'grime', 'boom bap', 'conscious hip hop', 'jazz rap', 'lo-fi', 'chillwave',
  'vaporwave', 'hyperpop', 'electropop', 'electro', 'industrial', 'darkwave', 'gothic rock',
  'trance', 'breakbeat', 'jungle', 'footwork', 'leftfield', 'chamber pop', 'baroque pop', 'sophisti-pop',
  'motown', 'northern soul', 'gospel', 'christmas', 'musical', 'spoken word', 'comedy',
];
const SET = new Set(COMMON_GENRES);
export const isKnownGenre = (t) => SET.has(String(t).toLowerCase());

/** Starter suggestions shown when you have not used many genres yet. */
export const STARTER_GENRES = ['rock', 'pop', 'hip hop', 'r&b', 'jazz', 'electronic', 'folk', 'soul', 'indie', 'classical', 'ambient', 'metal'];
