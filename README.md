# Potato (NetflixX/K)

A pixel-perfect Netflix clone streaming website built with vanilla JavaScript and Express. Uses TMDB for metadata and VidKing embed player for streaming. Includes an Android TV WebView wrapper app.

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

## Disclaimer

**This project is for educational and practice purposes only.**

I do not promote, encourage, or facilitate any illegal activity including copyright infringement or unauthorized streaming. This is a fun side project to learn full-stack development, API integration, and Android TV development. All streaming is handled via third-party embeds (VidKing); this codebase does not host, index, or distribute any copyrighted content.

Use responsibly and respect intellectual property rights.

## License

AGPL-3.0-only — see [LICENSE](LICENSE) for details.