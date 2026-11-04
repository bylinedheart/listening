# Listening

A personal music listening log. Plain HTML, CSS and JavaScript: no build step, no backend, no external libraries. Built for a phone first and installable as an app, so it works offline from your home screen.

## Features

- **Log a listen**: album or song, artist, date (defaults to today), half-star rating, a short note, and tags for genre or mood. You can rate each track on an album separately.
- **Quick add**: search for an album or song, then tap a result to fill in the cover, artist, release year, producers, label, genres and full track list. This uses [MusicBrainz](https://musicbrainz.org) and the [Cover Art Archive](https://coverartarchive.org). Both are free and need no API key. Type `title - artist` to narrow a search.
- **Shelves**: Listening now, Want to hear, and Logged. Tap any item to move it between shelves, rate it, or edit it.
- **History**: a compact list of logged listens, newest first, grouped by month. You can search it and filter by artist, tag and rating.
- **Stats**: total listens, average rating, current and longest streak (consecutive days with at least one listen), listens per month, top artists, top tags, and how your ratings are spread. All charts are inline SVG.
- **Backup**: export everything to a JSON file and import it again (merge or replace). The Data tab shows when you last exported, and the Shelves tab shows a reminder when you have changes that are more than a week past your last export.
- **Sample entries**: on first run, six entries marked "Sample" are added so you can see how things look. Remove them all with **Remove samples** on the Shelves tab or the Data tab.

Your data is stored in your browser's `localStorage` on that device only. Clearing site data removes it, so export a backup now and then.

## Run it locally

The app uses ES modules and a service worker, so it has to be served over HTTP. Opening `index.html` straight from disk will not work.

Any static file server works. With Python 3 installed:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

Or with Node.js installed:

```bash
npx serve .
```

To try it on your phone while it runs on your computer, connect both to the same Wi-Fi and open `http://<your-computer's-IP>:8000` on the phone. Note that browsers only allow the service worker (offline mode and installing) on `localhost` or over HTTPS, so for the full app experience on a phone, publish it with GitHub Pages as described below.

## Publish with GitHub Pages

1. Push this repository to GitHub.
2. On GitHub, open the repository and go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose the branch (for example `main`) and the folder **/ (root)**, then click **Save**.
5. After a minute or so, the site is live at `https://<your-username>.github.io/<repository-name>/`.

All paths in the app are relative, so it works from a subfolder like this without changes.

## Install it on your phone

Open the published site, then:

- **iPhone (Safari)**: tap the Share button, then **Add to Home Screen**.
- **Android (Chrome)**: tap the menu, then **Install app** or **Add to Home screen**.

Once installed, it opens full screen and works offline. Quick add needs a connection; everything else works without one.

## Updating the app

The service worker serves the cached app first and checks for a newer version in the background, so after you publish a change, it shows up the second time you open the app. If you add or rename files, add them to the `SHELL` list in `sw.js` and bump `VERSION` there.

## Project layout

```
index.html            Page shell and bottom navigation
css/app.css           All styles (light and dark)
js/app.js             Views, sheets, the log form, import and export
js/store.js           localStorage data store and backup format
js/lookup.js          Quick add (MusicBrainz and Cover Art Archive)
js/stats.js           Streaks, averages, top lists
js/charts.js          Inline SVG charts
js/stars.js           Half-star rating display and input
js/seed.js            Sample entries
js/util.js            Date and formatting helpers
sw.js                 Service worker for offline use
manifest.webmanifest  App name, colors and icons for installing
icons/                App icons
```

## Backup file format

An export is a JSON file like this:

```json
{
  "app": "listening",
  "version": 1,
  "exportedAt": "2026-11-04T18:00:00.000Z",
  "entries": [
    {
      "id": "…",
      "type": "album",
      "title": "Kind of Blue",
      "artist": "Miles Davis",
      "date": "2026-11-04",
      "shelf": "done",
      "rating": 4.5,
      "note": "",
      "tags": ["jazz"],
      "year": "1959",
      "producer": "Teo Macero",
      "label": "Columbia",
      "album": "",
      "cover": "https://…",
      "tracks": [{ "title": "So What", "length": 562000, "rating": 5 }]
    }
  ]
}
```

`shelf` is one of `now`, `want` or `done`. Ratings go from 0 (unrated) to 5 in steps of 0.5.
