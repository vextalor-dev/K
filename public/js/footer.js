// ============================================================
// K - footer.js
// Site footer with brand, links, disclaimer
// ============================================================

import { icon } from './utils.js';
import { APP_NAME, APK } from './config.js';

export function renderFooter(root) {
  const isAndroid = /Android/i.test(navigator.userAgent);
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
            <a href="#/terms">Terms of Service</a>
            <a href="#/terms-of-use">Terms of Use</a>
            ${isAndroid ? `<a href="${APK.url}" download="${APK.fileName}">Download TV App</a>` : ''}
          </div>
        </div>
        <button type="button" class="footer-backtotop" aria-label="Back to top">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
          Back to top
        </button>
        <div class="footer-copy">
          &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
        </div>
      </div>
    </div>
  `;
  root.querySelector('.footer-backtotop')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
