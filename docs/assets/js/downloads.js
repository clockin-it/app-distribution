// downloads.js — os botões de download: liga os de computador que o
// latest.json tem, marca a plataforma de quem visita e ajusta o botão da
// abertura.
//
// Os de Android e iOS têm endereço fixo no HTML (a loja). Os de computador
// (`data-source="manifest"`) nascem "Em breve" e são ligados aqui.

import { languageTag, translate } from './i18n.js';
import {
  findArtifacts,
  formatSize,
  loadManifest,
  platformNames,
} from './manifest.js';

/** O manifesto já lido, ou `null` — antes da resposta e quando ela falha. */
let manifest = null;

/** A plataforma de quem visita, ou `null` quando não dá para saber. */
function detectPlatform() {
  const hinted = navigator.userAgentData?.platform ?? '';
  const source = `${hinted} ${navigator.platform ?? ''} ${navigator.userAgent}`;
  if (/android/i.test(source)) return 'android';
  if (/iphone|ipad|ipod/i.test(source)) return 'ios';
  // O iPad se apresenta como Mac; o que o entrega é a tela de toque.
  if (/mac/i.test(source)) return navigator.maxTouchPoints > 1 ? 'ios' : 'macos';
  if (/win/i.test(source)) return 'windows';
  if (/linux|x11|cros/i.test(source)) return 'linux';
  return null;
}

const visitorPlatform = detectPlatform();

function artifactDetail(artifact) {
  const size = formatSize(artifact.size, languageTag());
  const version = translate('downloadVersion', { version: artifact.version });
  return size ? `${version} · ${size}` : version;
}

/** "Baixar para macOS" quando a plataforma de quem visita tem download. */
function renderHeroDownload() {
  const label = document.querySelector('[data-hero-download]');
  if (!label) return;

  const available =
    visitorPlatform !== null &&
    document.querySelector(
      `[data-download-app="app"] [data-platform="${visitorPlatform}"][href]`,
    ) !== null;

  if (available) {
    delete label.dataset.i18n;
    label.textContent = translate('heroDownloadFor', {
      platform: platformNames[visitorPlatform],
    });
  } else {
    label.dataset.i18n = 'heroDownload';
    label.textContent = translate('heroDownload');
  }
}

/**
 * Liga os botões de computador que o manifesto tem, e devolve ao "Em breve" os
 * que ele não tem. Roda a cada troca de idioma e quando o manifesto chega.
 */
export function renderDownloads() {
  for (const card of document.querySelectorAll('[data-download-app]')) {
    const app = card.dataset.downloadApp;

    for (const button of card.querySelectorAll('[data-platform]')) {
      const platform = button.dataset.platform;
      const item = button.parentElement;
      item.querySelector('.platform__more')?.remove();
      button.querySelector('.platform__badge')?.remove();

      if (button.dataset.source === 'manifest') {
        const detail = button.querySelector('[data-platform-detail]');
        const artifacts = manifest
          ? findArtifacts(manifest, { app, platform })
          : [];
        const [primary, ...others] = artifacts;

        if (primary) {
          button.href = primary.url;
          button.classList.remove('is-unavailable');
          button.removeAttribute('aria-disabled');
          delete detail.dataset.i18n;
          detail.textContent = artifactDetail(primary);

          // Os outros formatos da mesma plataforma, numa etiqueta embaixo.
          for (const artifact of others) {
            const link = document.createElement('a');
            link.className = 'platform__more';
            link.href = artifact.url;
            link.textContent = translate('downloadAlso', {
              format: `.${artifact.format}`,
            });
            item.append(link);
          }
        } else {
          button.removeAttribute('href');
          button.classList.add('is-unavailable');
          button.setAttribute('aria-disabled', 'true');
          detail.dataset.i18n = 'downloadComingSoon';
          detail.textContent = translate('downloadComingSoon');
        }
      }

      const isCurrent =
        platform === visitorPlatform && button.hasAttribute('href');
      button.classList.toggle('is-current', isCurrent);
      if (isCurrent) {
        const badge = document.createElement('span');
        badge.className = 'platform__badge';
        badge.textContent = translate('downloadYourPlatform');
        button.append(badge);
      }
    }
  }

  renderHeroDownload();
}

export async function initDownloads() {
  try {
    manifest = await loadManifest();
  } catch (error) {
    // Sem manifesto, os botões de computador ficam em "Em breve" e a lista de
    // versões do GitHub, no fim da seção, continua valendo.
    console.error(error);
  }
  renderDownloads();
}
