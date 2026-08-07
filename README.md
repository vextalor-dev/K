# K

A streaming website built with vanilla JavaScript and Express. Uses TMDB for metadata and VidKing embed player for playback. Includes an Android TV WebView wrapper app.

<img width="1600" height="764" alt="image" src="https://github.com/user-attachments/assets/aad5feeb-796f-42ba-8c31-b14971a3adae" />

## Features

- **TMDB Integration**: Movie/TV metadata, search, genres, trending
- **VidKing Embed Player**: Streaming via embed URLs
- **Responsive UI**: Hero carousel, rows, search, detail pages, my list
- **TV-Friendly**: Keyboard/gamepad navigation, immersive fullscreen
- **Android TV App**: WebView wrapper with landscape lock, back-button handling
- **Rate Limited & Cached**: TMDB proxy with in-memory cache and per-IP rate limiting
- **Deploy Ready**: Vercel config, GitHub Actions for APK builds

## Project Structure

```
├── public/              # Static frontend (HTML, CSS, JS)
│   ├── index.html       # App shell
│   ├── css/             # Modular stylesheets
│   ├── js/              # Vanilla JS modules (app, nav, search, watch, etc.)
│   ├── images/          # Assets
│   └── apk/             # Built Android APK
├── api/                 # TMDB proxy (serverless functions for Vercel)
├── functions/           # Netlify/Vercel functions mirror
├── tv-app/              # Android TV WebView app (Gradle)
│   ├── app/             # Android app source
│   └── README.md        # TV app build instructions
├── server.js            # Express server (local dev + TMDB proxy)
├── config.js            # Runtime config (API keys, ports)
├── vercel.json          # Vercel deployment config
└── package.json         # Dependencies (express only)
```

## Getting Started

### Prerequisites
- Node.js 18+
- TMDB API key (get from [themoviedb.org](https://www.themoviedb.org/settings/api))

### Local Development

```bash
# Clone and install
git clone https://github.com/vextalor-dev/Potato.git
cd Potato
npm install

# Create config.js with your keys (or set env vars)
# See config.js for required variables

# Start server
npm start
# Runs at http://localhost:3000
```

### Environment Variables
| Variable | Description |
|----------|-------------|
| `TMDB_API_KEY` | TMDB v3 API key (required) |
| `PORT` | Server port (default: 3000) |

## Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Import in Vercel
3. Add `TMDB_API_KEY` in Project Settings → Environment Variables
4. Deploy — `vercel.json` handles routing and functions

### Other Platforms
- Works on any Node host (Railway, Render, Fly.io, VPS)
- Set `TMDB_API_KEY` and run `npm start`

## Android TV App

The `tv-app/` directory contains a minimal WebView wrapper:
- Loads the hosted site (default: `https://potato-ashy.vercel.app/`)
- Landscape lock, immersive fullscreen
- Back-button navigation, HTML5 video fullscreen
- Auto-built via GitHub Actions on `tv-app/` changes

See [tv-app/README.md](tv-app/README.md) for build instructions and signing setup.

## ⚠️ Legal Disclaimer — Read Before Use

**THIS SOFTWARE IS PROVIDED STRICTLY FOR EDUCATIONAL, RESEARCH, AND PERSONAL LEARNING PURPOSES ONLY.**

### No Promotion of Illegal Activity
- I **do not promote, endorse, facilitate, encourage, or assist** in any form of copyright infringement, piracy, unauthorized streaming, or distribution of protected content.
- This project is a **proof-of-concept / learning exercise** demonstrating full-stack web development, API integration (TMDB), client-side rendering, and Android TV WebView implementation.

### No Hosted Infringing Content
- This codebase **does not host, store, index, link to, or distribute** any copyrighted audiovisual works.
- Streaming playback (if any) occurs via **third-party embed providers** (e.g., VidKing) over which this project has **zero control, affiliation, or responsibility**.
- The repository contains **only metadata fetch logic (TMDB) and UI code** — no video files, no streaming infrastructure, no CDN, no content.

### User Responsibility
- **You are solely responsible** for how you deploy, use, or extend this code.
- Any deployment that enables unauthorized access to copyrighted works **violates this project's intent and may violate applicable law** (DMCA, EUCD, local copyright statutes).
- Do **not** deploy publicly as a "free movie/TV site." Do **not** market or monetize this as a streaming service.

### Third-Party Services
- TMDB API usage is governed by [TMDB Terms of Use](https://www.themoviedb.org/documentation/terms-of-use) — obtain your own key; do not abuse rate limits.
- VidKing (or any embed source) is **unaffiliated** with this project. Their legality, availability, and content are **entirely their own responsibility**.

### No Warranty / Liability
- Provided "AS IS" under AGPL-3.0-only. **No warranty** — express or implied — of merchantability, fitness, or non-infringement.
- The author **accepts zero liability** for any direct, indirect, incidental, or consequential damages arising from use, misuse, or deployment of this software.

### Enforcement
- If you discover this code being used in violation of this disclaimer, you are encouraged to report it to the platform host (GitHub, Vercel, etc.) and/or the relevant rights holders.
- The author reserves the right to revoke access, archive the repository, or take other action if this project is misused.

**By cloning, forking, deploying, or modifying this repository, you acknowledge you have read, understood, and agreed to the above terms.**

## License

AGPL-3.0-only — see [LICENSE](LICENSE) for details.
