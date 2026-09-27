// showcase.js — a seção dos três apps: o aparelho fica parado na tela
// enquanto a rolagem troca de cena, um app por vez.
//
// No HTML:
//
//   data-showcase          a seção
//   data-showcase-track    o trecho alto, que dá à rolagem o caminho a andar
//   data-scene             cada cena — o texto de um app e o aparelho dele
//   data-showcase-go="1"   o botão que leva à cena
//
// A altura do trilho e o que fica preso são do CSS, e só valem em tela larga
// e com JavaScript: no celular, e sem script, as cenas viram uma lista.

import { clamp } from './motion.js';

export function initShowcase() {
  const showcase = document.querySelector('[data-showcase]');
  const track = showcase?.querySelector('[data-showcase-track]');
  if (!showcase || !track) return;

  const scenes = [...showcase.querySelectorAll('[data-scene]')];
  const buttons = [...showcase.querySelectorAll('[data-showcase-go]')];
  let active = 0;
  let scheduled = false;

  /** O trecho da rolagem em que o trilho anda: do topo dele ao fim. */
  const travel = () => {
    const bounds = track.getBoundingClientRect();
    return {
      start: bounds.top + window.scrollY,
      length: Math.max(1, bounds.height - window.innerHeight),
    };
  };

  const activate = (index) => {
    if (index === active) return;
    active = index;
    scenes.forEach((scene, position) => {
      scene.classList.toggle('is-active', position === index);
      scene.classList.toggle('is-past', position < index);
    });
    buttons.forEach((button, position) => {
      button.classList.toggle('is-active', position === index);
    });
  };

  const update = () => {
    scheduled = false;
    const { start, length } = travel();
    const progress = clamp((window.scrollY - start) / length, 0, 1);
    showcase.style.setProperty('--showcase-progress', progress.toFixed(4));
    activate(
      Math.min(scenes.length - 1, Math.floor(progress * scenes.length)),
    );
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(update);
  };

  for (const button of buttons) {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.showcaseGo) || 0;
      const { start, length } = travel();
      // O meio do trecho da cena: longe das duas trocas.
      window.scrollTo({
        top: start + (length * (index + 0.5)) / scenes.length,
      });
    });
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  schedule();
}
