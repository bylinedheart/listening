// Sample entries shown on first run. Every one is marked `sample: true`
// so they can be removed together from the Shelves banner or the Data tab.
import { addDays, todayISO } from './util.js';

export function makeSamples() {
  const t = todayISO();
  const base = { sample: true };
  return [
    {
      ...base, id: 'sample-kind-of-blue', type: 'album', shelf: 'done',
      title: 'Kind of Blue', artist: 'Miles Davis', year: '1959',
      producer: 'Teo Macero, Irving Townsend', label: 'Columbia',
      date: t, rating: 5, genres: ['jazz', 'modal jazz'], tags: ['late night'],
      note: 'Sample entry.',
      tracks: [
        { title: 'So What', length: 562000, rating: 5 },
        { title: 'Freddie Freeloader', length: 586000, rating: 4.5 },
        { title: 'Blue in Green', length: 337000, rating: 5 },
        { title: 'All Blues', length: 693000, rating: 4.5 },
        { title: 'Flamenco Sketches', length: 566000, rating: 4 },
      ],
    },
    {
      ...base, id: 'sample-teardrop', type: 'song', shelf: 'done',
      title: 'Teardrop', artist: 'Massive Attack', album: 'Mezzanine', year: '1998',
      producer: 'Neil Davidge, Massive Attack',
      date: addDays(t, -1), rating: 4.5, genres: ['trip hop', 'downtempo'], tags: ['rainy day'], note: 'Sample entry.',
    },
    {
      ...base, id: 'sample-hounds-of-love', type: 'album', shelf: 'done',
      title: 'Hounds of Love', artist: 'Kate Bush', year: '1985', producer: 'Kate Bush', label: 'EMI',
      date: addDays(t, -2), rating: 4.5, genres: ['art pop', 'progressive pop'], tags: [], note: 'Sample entry.',
    },
    {
      ...base, id: 'sample-remain-in-light', type: 'album', shelf: 'done',
      title: 'Remain in Light', artist: 'Talking Heads', year: '1980', producer: 'Brian Eno', label: 'Sire',
      date: addDays(t, -24), rating: 4, genres: ['new wave', 'funk', 'art rock'], tags: ['dance'], note: 'Sample entry.',
    },
    {
      ...base, id: 'sample-promises', type: 'album', shelf: 'now',
      title: 'Promises', artist: 'Floating Points, Pharoah Sanders & LSO', year: '2021',
      producer: 'Sam Shepherd', genres: ['ambient', 'spiritual jazz', 'contemporary classical'], tags: ['focus'], note: 'Sample entry.',
    },
    {
      ...base, id: 'sample-spirit-of-eden', type: 'album', shelf: 'want',
      title: 'Spirit of Eden', artist: 'Talk Talk', year: '1988', producer: 'Tim Friese-Greene',
      genres: ['art rock', 'post-rock'], tags: [], note: 'Sample entry.',
    },
  ];
}
