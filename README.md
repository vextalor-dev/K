<div align="center">

# K

**A modern streaming website built with vanilla JavaScript, Express & Vite.**

![License](https://img.shields.io/badge/license-AGPL--3.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![Vercel](https://img.shields.io/badge/deployed-Vercel-black)
---

<img width="1600" height="764" alt="K - Homepage" src="https://github.com/user-attachments/assets/aad5feeb-796f-42ba-8c31-b14971a3adae" />

<br>

[![Stars](https://img.shields.io/github/stars/vextalor-dev/K?style=social)](https://github.com/vextalor-dev/K/stargazers)

**If you find this project useful, consider giving it a star — it helps others discover it and keeps the project going.**

</div>

<br>

> A full-featured streaming UI powered by **TMDB** metadata and **VidKing** embed player, with an **Android TV** app — built as a learning project.

---

## Tech Stack

<div align="center">

![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![Android](https://img.shields.io/badge/Android-3DDC84?style=for-the-badge&logo=android&logoColor=white)

</div>

---

## Features

| Feature | Description |
|---------|-------------|
| **TMDB Integration** | Movie & TV metadata, search, genres, trending + v4 Bearer token support |
| **VidKing Player** | Streaming playback via embed URLs with progress resume |
| **Responsive UI** | Hero carousel, content rows, search, detail pages, my list |
| **TV-Optimized** | Keyboard/gamepad navigation, immersive fullscreen, watch progress |
| **History Router** | Clean URLs (`/title/movie/123`, `/search?q=foo`), hash fallback for legacy links |
| **Android TV App** | WebView wrapper with landscape lock, back-button handling |
| **Rate Limiting** | Per-IP sliding window (150 req/min) + CDN cache (`s-maxage=3600`) |
| **SEO & PWA** | `sitemap.xml`, `robots.txt`, `manifest.webmanifest`, canonical OG, SearchAction |
| **One-Click Deploy** | Vercel + Cloudflare Pages ready, GitHub Releases for APK |

---

## Project Structure

```
K/
├── public/              # Static frontend
│   ├── index.html       # App shell (History router + hash fallback)
│   ├── css/             # Modular stylesheets
│   ├── js/              # Vanilla JS modules (router.js, api.js, watch.js …)
│   ├── images/          # Assets
│   ├── manifest.webmanifest, robots.txt, sitemap.xml
│   └── apk/.gitkeep     # APK now via GitHub Releases (see .gitignore)
├── api/                 # TMDB proxy (Vercel) + shared _lib/tmdb.js
├── functions/api/tmdb/  # Cloudflare Pages Function (mirrors api/)
├── tv-app/              # Android TV WebView app
│   └── app/             # Android source (Gradle, v1.0.1)
├── tests/               # Vitest (utils, tmdbProxy)
├── scripts/             # generate-sitemap.js
├── server.js            # Express with compression, /api/health, shared proxy
├── config.js            # Runtime config (TMDB_API_KEY + optional TMDB_BEARER)
├── vite.config.js       # Vite bundler (optional, output dist/)
├── vercel.json          # Vercel rewrites + security headers
└── package.json         # npm 1.0.1
```

---

## Getting Started

### Prerequisites

- **Node.js** 18 or higher
- **TMDB API key** — get one at [themoviedb.org](https://www.themoviedb.org/settings/api)

### Installation

```bash
git clone https://github.com/vextalor-dev/K.git
cd K
npm install
```

### Configuration

Set env vars (never commit keys):

```bash
# Windows (PowerShell)
$env:TMDB_API_KEY="your_tmdb_api_key"
# optional v4 Bearer token (recommended, not logged in querystrings)
$env:TMDB_BEARER_TOKEN="your_tmdb_bearer"
npm start
# → http://localhost:3000

# Linux / macOS
TMDB_API_KEY=your_key npm start
```

Or create a `.env` file (gitignored) and export it before start.

### Run & Develop

```bash
npm start          # Express server on :3000 (production-like)
npm run dev        # Vite dev server with HMR (proxies /api to :3000)
npm run dev:server # Express only
npm test           # Vitest
npm run lint       # ESLint
npm run format     # Prettier
npm run build      # Vite → dist/ (optional for self-host, Vercel uses public/)
```

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import repo in [Vercel](https://vercel.com)
3. Add `TMDB_API_KEY` (or `TMDB_BEARER_TOKEN`) in **Settings → Environment Variables**
4. Deploy — `vercel.json` handles rewrites (`/title/:type/:id`, `/watch`, `/search` → `index.html`), caching & CSP
5. `npm run vercel-build` auto-generates `public/sitemap.xml`

### Cloudflare Pages (Alt)

1. Connect repo in Cloudflare Dashboard → Pages
2. Set `TMDB_API_KEY` in **Settings → Environment Variables**
3. Functions at `functions/api/tmdb/[[path]].js` run as Pages Functions (mirrors Vercel proxy)
4. `_headers` + `_redirects` handle SPA fallback + security

### Other Platforms

Works on any Node.js host (Railway, Render, Fly.io, VPS). Just set `TMDB_API_KEY` and run `npm start`. Health at `/api/health`.

---

## Android TV App

The `tv-app/` directory contains a WebView wrapper:

- Loads the hosted site in fullscreen
- Landscape lock + immersive mode
- Back-button navigation
- HTML5 video fullscreen support
- Auto-built via **GitHub Actions**

See [`tv-app/README.md`](tv-app/README.md) for build & signing instructions.

---

## Disclaimer

> **This project is strictly for educational and personal learning purposes.**

- I **do not** promote, endorse, or facilitate any form of copyright infringement, piracy, or unauthorized streaming.
- This is a **proof-of-concept** demonstrating full-stack web development, API integration, and Android TV development.
- The codebase **does not host, store, or distribute** any copyrighted content. All streaming is handled by **third-party embed providers** (VidKing) over which this project has no control.
- **You are solely responsible** for how you deploy and use this code.
- Provided **"AS IS"** under AGPL-3.0. **No warranty** of any kind.

By using this project, you agree to these terms.

---

## License

This project is licensed under the **GNU Affero General Public License v3.0** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">


</div>
