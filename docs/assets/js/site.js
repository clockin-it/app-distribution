// site.js — o comportamento da home: idioma, tema, os efeitos de rolagem e os
// botões de download.
//
// A página funciona sem este arquivo: o texto está no HTML, em português, e os
// links das lojas são fixos. O que ele acrescenta é movimento e o que depende
// de dado — o idioma escolhido, a plataforma de quem visita e a última versão
// publicada (latest.json).
//
// Todo efeito de movimento confere `prefers-reduced-motion` antes de ligar.

import {
  currentLanguage,
  languageTag,
  onLanguageChange,
  setLanguage,
  translate,
} from './i18n.js';
import {
  findArtifacts,
  formatSize,
  loadManifest,
  platformNames,
} from './manifest.js';

/** Quanto da tela um elemento precisa mostrar para entrar em cena. */
const revealThreshold = 0.12;

/** A inclinação máxima dos cartões dos apps, em graus. */
const maximumTiltDegrees = 5;

/** Quanto o parallax do ponteiro se aproxima do alvo a cada quadro (0 a 1). */
const pointerEasing = 0.08;

/** A rolagem, em pixels, a partir da qual o cabeçalho ganha fundo. */
const headerScrollThreshold = 12;

const themeStorageKey = 'theme';
const themeCycle = ['auto', 'light', 'dark'];
const themeLabelKeys = {
  auto: 'themeAuto',
  light: 'themeLight',
  dark: 'themeDark',
};

const root = document.documentElement;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

/** O manifesto já lido, ou `null` — antes da resposta e quando ela falha. */
let manifest = null;

// -----------------------------------------------------------------------------
// Idioma
// -----------------------------------------------------------------------------

function initLanguage() {
  const options = [...document.querySelectorAll('[data-language-option]')];

  const markCurrent = () => {
    const language = currentLanguage();
    for (const option of options) {
      const selected = option.dataset.languageOption === language;
      option.setAttribute('aria-pressed', String(selected));
    }
  };

  for (const option of options) {
    option.addEventListener('click', () => {
      setLanguage(option.dataset.languageOption, { persist: true });
    });
  }

  // O que o `data-i18n` não alcança — texto montado com valor — é refeito a
  // cada troca de idioma.
  onLanguageChange(() => {
    markCurrent();
    updateThemeLabel();
    updateClock();
    renderDownloads();
  });

  markCurrent();
  return setLanguage(currentLanguage());
}

// -----------------------------------------------------------------------------
// Tema
// -----------------------------------------------------------------------------

function currentTheme() {
  const theme = root.dataset.theme;
  return theme === 'light' || theme === 'dark' ? theme : 'auto';
}

function updateThemeLabel() {
  const button = document.querySelector('[data-theme-switch]');
  if (!button) return;
  const key = themeLabelKeys[currentTheme()];
  button.dataset.i18nAttr = `aria-label:${key}`;
  button.setAttribute('aria-label', translate(key));
  button.title = translate(key);
}

function initTheme() {
  const button = document.querySelector('[data-theme-switch]');
  if (!button) return;

  button.addEventListener('click', () => {
    const next =
      themeCycle[(themeCycle.indexOf(currentTheme()) + 1) % themeCycle.length];
    if (next === 'auto') {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = next;
    }
    try {
      if (next === 'auto') {
        window.localStorage.removeItem(themeStorageKey);
      } else {
        window.localStorage.setItem(themeStorageKey, next);
      }
    } catch (error) {
      // Sem armazenamento a escolha vale só para esta visita.
    }
    updateThemeLabel();
  });
}

// -----------------------------------------------------------------------------
// Entrada em cena
// -----------------------------------------------------------------------------

function initReveal() {
  const elements = [...document.querySelectorAll('.reveal')];
  if (!('IntersectionObserver' in window) || reducedMotion.matches) {
    for (const element of elements) element.classList.add('is-visible');
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    },
    { threshold: revealThreshold, rootMargin: '0px 0px -6% 0px' },
  );
  for (const element of elements) observer.observe(element);
}

// -----------------------------------------------------------------------------
// Rolagem: cabeçalho, barra de progresso, parallax e os passos
// -----------------------------------------------------------------------------

/**
 * Tudo o que acompanha a rolagem sai de um laço só, no ritmo da tela
 * (`requestAnimationFrame`). Ele roda enquanto há o que atualizar — a rolagem
 * mudou, ou o ponteiro ainda não chegou ao alvo — e para sozinho.
 */
function initScrollEffects() {
  const header = document.querySelector('[data-header]');
  const steps = document.querySelector('[data-steps]');
  const stepItems = steps ? [...steps.querySelectorAll('[data-step]')] : [];
  const navigationLinks = [...document.querySelectorAll('.site-nav a')];
  const sections = navigationLinks
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  const layers = [...document.querySelectorAll('[data-parallax]')].map(
    (element) => ({
      element,
      host: element.closest('[data-parallax-host]'),
      pointerHost: element.closest('[data-pointer-host]'),
      scrollFactor: Number(element.dataset.parallax) || 0,
      pointerRange: Number(element.dataset.pointer) || 0,
    }),
  );

  // A posição de cada anfitrião no documento, medida fora do laço: ler o
  // layout a cada quadro custa caro.
  const hostMetrics = new Map();
  const measure = () => {
    for (const { host } of layers) {
      if (!host || hostMetrics.has(host)) continue;
      const bounds = host.getBoundingClientRect();
      hostMetrics.set(host, {
        top: bounds.top + window.scrollY,
        height: bounds.height,
      });
    }
  };
  const remeasure = () => {
    hostMetrics.clear();
    measure();
  };

  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  let scheduled = false;

  const update = () => {
    scheduled = false;
    const scrollY = window.scrollY;
    const viewportHeight = window.innerHeight;
    const scrollable =
      document.documentElement.scrollHeight - viewportHeight || 1;

    root.style.setProperty(
      '--scroll-progress',
      Math.min(1, Math.max(0, scrollY / scrollable)).toFixed(4),
    );
    header?.classList.toggle('is-scrolled', scrollY > headerScrollThreshold);

    // A seção em que a pessoa está, marcada no menu.
    let currentSection = null;
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= viewportHeight * 0.4) {
        currentSection = section;
      }
    }
    for (const link of navigationLinks) {
      const isCurrent =
        currentSection !== null &&
        link.getAttribute('href') === `#${currentSection.id}`;
      link.classList.toggle('is-current', isCurrent);
    }

    if (steps) {
      // O trilho enche enquanto a lista atravessa o meio da tela.
      const bounds = steps.getBoundingClientRect();
      const start = viewportHeight * 0.8;
      const end = viewportHeight * 0.35;
      const progress = Math.min(
        1,
        Math.max(0, (start - bounds.top) / (start - end + bounds.height * 0.3)),
      );
      const shown = reducedMotion.matches ? 1 : progress;
      steps.style.setProperty('--steps-progress', shown.toFixed(4));
      stepItems.forEach((item, index) => {
        const threshold = index / Math.max(1, stepItems.length - 1);
        item.classList.toggle('is-active', shown >= threshold * 0.98 - 0.001);
      });
    }

    if (reducedMotion.matches) return;

    pointer.x += (pointer.targetX - pointer.x) * pointerEasing;
    pointer.y += (pointer.targetY - pointer.y) * pointerEasing;
    const pointerSettled =
      Math.abs(pointer.targetX - pointer.x) < 0.001 &&
      Math.abs(pointer.targetY - pointer.y) < 0.001;

    for (const layer of layers) {
      const metrics = hostMetrics.get(layer.host);
      if (!metrics) continue;
      const hostTop = metrics.top - scrollY;
      if (hostTop > viewportHeight || hostTop + metrics.height < 0) continue;

      // A distância do meio do anfitrião ao meio da tela: zero quando ele está
      // centrado, e é aí que cada camada fica no lugar em que foi desenhada.
      const offset = hostTop + metrics.height / 2 - viewportHeight / 2;
      const scrollShift = offset * layer.scrollFactor;
      const pointerShiftX = layer.pointerHost
        ? pointer.x * layer.pointerRange
        : 0;
      const pointerShiftY = layer.pointerHost
        ? pointer.y * layer.pointerRange * 0.6
        : 0;
      layer.element.style.transform = `translate3d(${pointerShiftX.toFixed(2)}px, ${(scrollShift + pointerShiftY).toFixed(2)}px, 0)`;
    }

    if (!pointerSettled) schedule();
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(update);
  };

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', () => {
    remeasure();
    schedule();
  });
  window.addEventListener('load', () => {
    remeasure();
    schedule();
  });

  if (finePointer.matches) {
    for (const host of document.querySelectorAll('[data-pointer-host]')) {
      host.addEventListener('pointermove', (event) => {
        const bounds = host.getBoundingClientRect();
        pointer.targetX = (event.clientX - bounds.left) / bounds.width - 0.5;
        pointer.targetY = (event.clientY - bounds.top) / bounds.height - 0.5;
        schedule();
      });
      host.addEventListener('pointerleave', () => {
        pointer.targetX = 0;
        pointer.targetY = 0;
        schedule();
      });
    }
  }

  // Quem liga "reduzir movimento" com a página aberta: as camadas voltam ao
  // lugar em que foram desenhadas.
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) {
      for (const { element } of layers) element.style.transform = '';
    }
    schedule();
  });

  measure();
  schedule();
}

// -----------------------------------------------------------------------------
// A inclinação dos cartões dos apps
// -----------------------------------------------------------------------------

function initTilt() {
  if (!finePointer.matches) return;

  for (const card of document.querySelectorAll('[data-tilt]')) {
    card.addEventListener('pointermove', (event) => {
      if (reducedMotion.matches) return;
      const bounds = card.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width;
      const y = (event.clientY - bounds.top) / bounds.height;
      card.classList.add('is-tilting');
      card.style.setProperty(
        '--tilt-x',
        `${((0.5 - y) * 2 * maximumTiltDegrees).toFixed(2)}deg`,
      );
      card.style.setProperty(
        '--tilt-y',
        `${((x - 0.5) * 2 * maximumTiltDegrees).toFixed(2)}deg`,
      );
      card.style.setProperty('--glare-x', `${(x * 100).toFixed(1)}%`);
      card.style.setProperty('--glare-y', `${(y * 100).toFixed(1)}%`);
    });
    card.addEventListener('pointerleave', () => {
      card.classList.remove('is-tilting');
      card.style.removeProperty('--tilt-x');
      card.style.removeProperty('--tilt-y');
    });
  }
}

// -----------------------------------------------------------------------------
// O relógio da encenação do app
// -----------------------------------------------------------------------------

function updateClock() {
  const weekday = document.querySelector('[data-clock-weekday]');
  const date = document.querySelector('[data-clock-date]');
  const time = document.querySelector('[data-clock-time]');
  if (!weekday || !date || !time) return;

  const now = new Date();
  const locale = languageTag();
  weekday.textContent = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
  }).format(now);
  date.textContent = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
  }).format(now);
  // Com "reduzir movimento", o relógio anda de minuto em minuto.
  time.textContent = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: reducedMotion.matches ? undefined : '2-digit',
    hour12: false,
  }).format(now);
}

function initClock() {
  updateClock();
  window.setInterval(updateClock, 1000);
}

// -----------------------------------------------------------------------------
// Download
// -----------------------------------------------------------------------------

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

/**
 * Liga os botões de computador que o manifesto tem, e devolve ao "Em breve" os
 * que ele não tem. Roda a cada troca de idioma e quando o manifesto chega.
 */
function renderDownloads() {
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

          // Os outros formatos da mesma plataforma, num link menor embaixo.
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

async function initDownloads() {
  try {
    manifest = await loadManifest();
  } catch (error) {
    // Sem manifesto, os botões de computador ficam em "Em breve" e a lista de
    // versões do GitHub, no fim da seção, continua valendo.
    console.error(error);
  }
  renderDownloads();
}

// -----------------------------------------------------------------------------

function initFooter() {
  const year = document.querySelector('[data-current-year]');
  if (year) year.textContent = String(new Date().getFullYear());
}

async function start() {
  initTheme();
  initFooter();
  initReveal();
  initScrollEffects();
  initTilt();

  // O idioma vem antes do relógio e dos downloads: os dois escrevem texto.
  await initLanguage();
  updateThemeLabel();
  initClock();
  await initDownloads();
}

start();
