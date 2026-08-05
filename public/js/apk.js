// ============================================================
// K - apk.js
// Offers the K TV Android APK download to Android devices.
// Auto-triggers once per APK version (so it does not re-download
// on every visit) and shows where the file was saved.
// ============================================================

import { APK } from './config.js';

const STORE_KEY = `k-apk-dl-${APK.version}`;

function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

function triggerDownload(url) {
  const a = document.createElement('a');
  a.href = url;
  a.download = APK.fileName;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function showBanner(saved) {
  if (document.getElementById('k-apk-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'k-apk-banner';
  banner.className = 'apk-banner';
  banner.innerHTML = `
    <div class="apk-banner-inner">
      <div class="apk-banner-icon" aria-hidden="true">📱</div>
      <div class="apk-banner-body">
        <div class="apk-banner-title">K TV App ${saved ? 'saved' : 'available'}</div>
        <div class="apk-banner-text">
          ${saved
            ? `Saved to <b>${APK.savePath}</b> (Downloads). Open Files &rarr; Downloads to install.`
            : 'Install the K TV app on this device.'}
        </div>
        <div class="apk-banner-actions">
          <button type="button" class="apk-btn" id="k-apk-dl">${saved ? 'Download again' : 'Download'}</button>
          <button type="button" class="apk-btn apk-btn-ghost" id="k-apk-close">Dismiss</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(banner);

  document.getElementById('k-apk-dl').addEventListener('click', () => {
    triggerDownload(APK.url);
  });
  document.getElementById('k-apk-close').addEventListener('click', () => banner.remove());
}

export function maybeOfferApk() {
  if (!isAndroid()) return;

  const saved = localStorage.getItem(STORE_KEY) === '1';
  if (!saved) {
    triggerDownload(APK.url);
    try { localStorage.setItem(STORE_KEY, '1'); } catch {}
  }
  showBanner(saved);
}
