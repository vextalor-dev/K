<div align="center">

# K

**A modern streaming website built with vanilla JavaScript and Express.**

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
| **TMDB Integration** | Movie & TV metadata, search, genres, trending content |
| **VidKing Player** | Streaming playback via embed URLs |
| **Responsive UI** | Hero carousel, content rows, search, detail pages, my list |
| **TV-Optimized** | Keyboard/gamepad navigation, immersive fullscreen |
| **Android TV App** | WebView wrapper with landscape lock, back-button handling |
| **Rate Limiting** | Per-IP sliding window (150 req/min) with in-memory cache |
| **One-Click Deploy** | Vercel-ready with GitHub Actions for APK builds |

---

## Project Structure

```
K/
├── public/              # Static frontend
│   ├── index.html       # App shell
│   ├── css/             # Modular stylesheets
│   ├── js/              # Vanilla JS modules
│   ├── images/          # Assets
│   └── apk/             # Built Android APK
├── api/                 # TMDB proxy (Vercel serverless)
├── tv-app/              # Android TV WebView app
│   └── app/             # Android source (Gradle)
├── server.js            # Express server
├── config.js            # Runtime config
├── vercel.json          # Vercel deployment
└── package.json
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

Create a `config.js` file in the root:

```js
module.exports = {
  TMDB_API_KEY: 'your_tmdb_api_key_here',
  PORT: 3000
};
```

### Run

```bash
npm start
# → http://localhost:3000
```

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import repo in [Vercel](https://vercel.com)
3. Add `TMDB_API_KEY` in **Settings → Environment Variables**
4. Deploy — `vercel.json` handles everything

### Other Platforms

Works on any Node.js host (Railway, Render, Fly.io, VPS). Just set `TMDB_API_KEY` and run `npm start`.

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
