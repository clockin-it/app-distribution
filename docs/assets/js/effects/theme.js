// theme.js — o botão de tema: automático → claro → escuro.
//
// A escolha vai para `data-theme` no <html> (o CSS faz o resto) e fica
// guardada no aparelho; no automático o atributo sai e vale o do sistema.
//
// A troca se abre num círculo a partir do botão, pela View Transitions API.
// Onde ela não existe, ou com "reduzir movimento", o tema troca na hora.

import { translate } from '../i18n.js';
import { reducedMotion } from './motion.js';

const themeStorageKey = 'theme';
const themeCycle = ['auto', 'light', 'dark'];
const themeLabelKeys = {
  auto: 'themeAuto',
  light: 'themeLight',
  dark: 'themeDark',
};

const root = document.documentElement;

function currentTheme() {
  const theme = root.dataset.theme;
  return theme === 'light' || theme === 'dark' ? theme : 'auto';
}

/** O rótulo do botão diz o tema em uso, no idioma em uso. */
export function updateThemeLabel() {
  const button = document.querySelector('[data-theme-switch]');
  if (!button) return;
  const key = themeLabelKeys[currentTheme()];
  button.dataset.i18nAttr = `aria-label:${key}`;
  button.setAttribute('aria-label', translate(key));
  button.title = translate(key);
}

function apply(theme) {
  if (theme === 'auto') {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = theme;
  }
  try {
    if (theme === 'auto') {
      window.localStorage.removeItem(themeStorageKey);
    } else {
      window.localStorage.setItem(themeStorageKey, theme);
    }
  } catch (error) {
    // Sem armazenamento a escolha vale só para esta visita.
  }
  updateThemeLabel();
  // Quem desenha com cor lida do CSS (a constelação) relê a cor.
  document.dispatchEvent(new CustomEvent('themechange'));
}

export function initTheme() {
  const button = document.querySelector('[data-theme-switch]');
  if (!button) return;

  button.addEventListener('click', () => {
    const next =
      themeCycle[(themeCycle.indexOf(currentTheme()) + 1) % themeCycle.length];

    if (!document.startViewTransition || reducedMotion.matches) {
      apply(next);
      return;
    }

    // O círculo nasce no meio do botão e cresce até o canto mais distante.
    const bounds = button.getBoundingClientRect();
    const x = bounds.left + bounds.width / 2;
    const y = bounds.top + bounds.height / 2;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );
    root.style.setProperty('--theme-x', `${x}px`);
    root.style.setProperty('--theme-y', `${y}px`);
    root.style.setProperty('--theme-radius', `${radius}px`);
    root.classList.add('is-changing-theme');

    document
      .startViewTransition(() => apply(next))
      .finished.finally(() => root.classList.remove('is-changing-theme'));
  });
}
