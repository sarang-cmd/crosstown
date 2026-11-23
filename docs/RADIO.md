# Crosstown · in-car radio and optional providers

**0.13.0 / 13.001 · 22 November 2026.** `Y` opens the radio while inside a car, including the handling lab. It stops on exit, keeps per-browser favourites/custom links and ducks for sirens/ignition. The dash and HUD show the current source/title. First use still needs an ordinary browser input gesture. See [verification](TESTING.md) for what actually played; implementation is not provider acceptance.

## Available without accounts

- Four original code-generated stations: **Slow Lane / lo-fi, Night Drive / synthwave, Side Street / funk, Far Shores / ambient**. No commercial tracks or samples are bundled. Note scheduling is bounded to 32 active/scheduled sources; procedural changes fade over about 180 ms and streams over 250 ms, with a short original tuning-static cue.
- **Radio Browser:** country **code**, language and genre filters, healthy-station filtering, several API mirrors, descriptive `Crosstown/0.13` app identity, HTTPS-only streams on HTTPS pages and failed-station removal. Playback is a plain `HTMLAudioElement`; there is deliberately no CORS-dependent Web Audio analyser. A catalogue result is not an uptime/rights guarantee.
- External stations are contacted only when browsed/selected, not by the landing page. URLs/titles are bounded/validated and inserted safely. Some streams are geo-blocked, expire or require another user gesture; the four local stations remain available.

## YouTube and SoundCloud

Paste a public HTTPS video/playlist or track/set link into **Your links**. Playback uses the **official YouTube IFrame API** or **SoundCloud Widget API**, not extracted audio, scraping or downloaded media. Their player remains visible, with the provider's own controls/branding. The YouTube viewport is 320×200. Game play/pause, next/previous, volume and shuffle forward to those official APIs; a single item may have nothing to skip to. Seek is provider-dependent. If autoplay is denied, click the official play control. Provider scripts have an eight-second readiness timeout and unavailable providers are removed for that session.

Only the **observed playback events/media-time progression** in the saved reports count as browser playback acceptance. Provider pages merely existing, a selected source, or a successful API method call is not proof of hearing a track or successfully skipping. Embedding/region/login restrictions and provider errors remain possible. See `evidence/crosstown-0.13.0/radio-provider-acceptance.json` for actual attempts, screenshots and failed-or-unavailable rows. No by-ear review or cross-browser provider guarantee is claimed.

## Optional Spotify development setup

Spotify is **hidden by default**. No SDK request is made without a non-empty public client ID.

1. Create/review your own Spotify developer application and its current access restrictions. **Do not add a client secret.** Copy `.env.example` to an untracked `.env.local` and set only `VITE_SPOTIFY_CLIENT_ID=your_public_client_id`.
2. Register the exact loopback redirect **`http://127.0.0.1:5173/callback`**, not `localhost`. Browse the dev app at `http://127.0.0.1:5173`. A production app also needs its exact **`https://YOUR-DOMAIN/callback`** registered. The callback path must rewrite to `index.html` as in `vercel.json`.
3. Restart Vite/rebuild after changing the public client ID. Vite embeds `VITE_*` values in the public bundle; never put passwords or secrets there.
4. Use Spotify Premium and an app-authorized user. Current Development Mode requirements include a Premium app owner and a small allowlist (documented as up to five authenticated users); a successful login alone does not prove Web API permission. Quotas, endpoint availability and account restrictions can produce 403/429 responses. Extended quota requires Spotify's review and eligibility; it is not automatically available to this prototype.
5. In the car, choose Spotify and connect. Authorization uses **PKCE S256**, fresh random verifier/state, exact redirect and a ten-minute in-flight check. Tokens/verifier live only in guarded session storage, not the source, URL, persistent game save, logs or the ZIP. Access tokens refresh when needed. Reset clears this app's OAuth session keys as well.
6. The implementation includes the official Web Playback SDK, playlists/liked tracks, play/pause, next/previous, shuffle, volume, seek and queue controls. **Authenticated acceptance is untested without the user's client ID/account/Premium session.** In particular, current playlist-item endpoint/permission compatibility must be checked with that authorized app. An eight-second SDK timeout or source failure hides Spotify gracefully; no silence is advertised as working playback.

### Provider terms are a separate release gate

Spotify's streaming policy restricts commercial use and synchronization with visual media. This repository does **not** establish that a game/background-radio integration is permitted or exempt. Keep Spotify disabled on the public build unless the application/use has the necessary Spotify approval and current terms review. Public YouTube/SoundCloud content and internet stations also retain their authors' and providers' rights; the game's CC0 original assets do not relicense them.

Official references: [Radio Browser](https://docs.radio-browser.info/), [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference), [SoundCloud Widget](https://developers.soundcloud.com/docs/api/html5-widget), [Spotify PKCE](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow), [quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes), [Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk/reference).

## Files and reproduction

`src/radio/{index,sources,procedural,embeds,spotify,callback}.ts`; `src/audio/parkour-audio.ts`; dashboard text in `src/vehicles/cockpit.ts`. The standalone HTTPS fixture serves the **actual modules** through Vite and contacts real providers, without mocks. Run Vite on 5173, then `npm run accept:radio`. Inspect the JSON rows, **not only the exit code**: unavailable-provider rows are recorded without terminating unrelated radio checks. No private credentials are needed for the non-Spotify tests.
