// ============================================================
// K - footer.js
// Site footer with brand, links, disclaimer
// ============================================================

import { icon } from './utils.js';
import { APP_NAME } from './config.js';

export function renderFooter(root) {
  root.innerHTML = `
    <div class="footer">
      <div class="footer-inner layout-container">
        <div class="footer-top">
          <div class="footer-brand">
            <a href="#/" class="logo" aria-label="${APP_NAME} - Home">
              <img src="images/logo.svg" alt="${APP_NAME}" width="32" height="32">
              <span class="logo-text">${APP_NAME}</span>
            </a>
          </div>
          <div class="footer-links">
            <a href="#/movies">Movies</a>
            <a href="#/tv">TV Shows</a>
            <a href="#/anime">Anime</a>
            <a href="#/new">New & Popular</a>
            <a href="#/mylist">My List</a>
            <a href="#/languages">Languages</a>
            <a href="#/kids">Kids</a>
            <a href="#/search">Search</a>
          </div>
        </div>
        <div class="footer-disclaimer">
          This product uses the TMDB API but is not endorsed or certified by TMDB. All metadata and images are provided by The Movie Database (TMDB). Streaming is provided by third-party embed services.
        </div>
        <div class="footer-copy">
          &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
        </div>
      </div>
    </div>
  `;
}
