// site.js — a entrada da home: liga cada parte, na ordem.
//
// A página funciona sem este arquivo: o texto está no HTML, em português, e os
// links das lojas são fixos. O que ele acrescenta é movimento e o que depende
// de dado — o idioma escolhido, a plataforma de quem visita e a última versão
// publicada (latest.json).
//
// Cada parte mora no arquivo dela:
//
//   i18n.js, manifest.js     os textos e o manifesto
//   downloads.js             os botões de download
//   effects/reveal.js        a entrada em cena e os títulos palavra por palavra
//   effects/scroll.js        o que acompanha a rolagem
//   effects/pointer.js       o que responde ao ponteiro
//   effects/particles.js     a constelação do fundo da abertura
//   effects/demo.js          o relógio e o app que bate o ponto sozinho
//   effects/showcase.js      a seção dos apps, que troca de cena
//   effects/theme.js         o botão de tema
//
// Todo efeito de movimento confere `prefers-reduced-motion` antes de ligar
// (effects/motion.js).

import { initDownloads, renderDownloads } from './downloads.js';
import { initDemo, updateClock } from './effects/demo.js';
import { initParticles } from './effects/particles.js';
import { initPointer } from './effects/pointer.js';
import { initReveal, splitText } from './effects/reveal.js';
import { initScroll } from './effects/scroll.js';
import { initShowcase } from './effects/showcase.js';
import { initTheme, updateThemeLabel } from './effects/theme.js';
import { currentLanguage, onLanguageChange, setLanguage } from './i18n.js';

function initLanguage(scroll) {
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

  // O que o `data-i18n` não alcança — texto montado com valor, texto partido
  // em palavras — é refeito a cada troca de idioma.
  onLanguageChange(() => {
    markCurrent();
    splitText();
    updateThemeLabel();
    updateClock();
    renderDownloads();
    scroll.refresh();
  });

  markCurrent();
  return setLanguage(currentLanguage());
}

function initFooter() {
  const year = document.querySelector('[data-current-year]');
  if (year) year.textContent = String(new Date().getFullYear());
}

async function start() {
  // Os títulos são partidos antes de a entrada em cena começar a observá-los.
  splitText();
  initTheme();
  initFooter();
  initReveal();
  const scroll = initScroll();
  initShowcase();
  initPointer();
  initParticles();

  // O idioma vem antes do relógio e dos downloads: os dois escrevem texto.
  await initLanguage(scroll);
  updateThemeLabel();
  initDemo();
  await initDownloads();
}

start();
