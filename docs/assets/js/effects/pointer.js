// pointer.js — o que responde ao ponteiro: a luz que o segue na abertura, o
// aparelho que inclina, o brilho na borda dos cartões e os botões que se
// deixam puxar.
//
// No HTML:
//
//   data-pointer-glow       a luz que segue o ponteiro dentro da seção
//   data-tilt               inclina em 3D com o ponteiro na seção
//   data-spotlight-group    o grupo de cartões que divide um foco de luz
//   data-spotlight          cada cartão do grupo
//   data-magnetic           o botão que anda um pouco na direção do ponteiro
//
// Só liga com mouse ou trackpad: no toque não há ponteiro pairando.

import { clamp, finePointer, lerp, reducedMotion } from './motion.js';

/** A inclinação máxima do aparelho, em graus. */
const maximumTiltDegrees = 9;

/** Quanto a inclinação se aproxima do alvo a cada quadro (0 a 1). */
const tiltEasing = 0.09;

/** Quanto o botão anda na direção do ponteiro, em fração da distância. */
const magneticStrength = 0.28;

/** O limite do passeio do botão, em pixels. */
const magneticLimit = 10;

function initGlow() {
  for (const glow of document.querySelectorAll('[data-pointer-glow]')) {
    const host = glow.closest('[data-pointer-host]');
    if (!host) continue;
    host.addEventListener('pointermove', (event) => {
      const bounds = host.getBoundingClientRect();
      glow.style.setProperty('--glow-x', `${event.clientX - bounds.left}px`);
      glow.style.setProperty('--glow-y', `${event.clientY - bounds.top}px`);
      glow.classList.add('is-visible');
    });
    host.addEventListener('pointerleave', () => {
      glow.classList.remove('is-visible');
    });
  }
}

function initTilt() {
  for (const element of document.querySelectorAll('[data-tilt]')) {
    const host = element.closest('[data-pointer-host]');
    if (!host) continue;

    const state = { x: 0, y: 0, targetX: 0, targetY: 0 };
    let scheduled = false;

    const update = () => {
      scheduled = false;
      state.x = lerp(state.x, state.targetX, tiltEasing);
      state.y = lerp(state.y, state.targetY, tiltEasing);

      // O ponteiro à direita vira o aparelho para a direita; acima, para cima.
      element.style.setProperty(
        '--tilt-x',
        `${(-state.y * maximumTiltDegrees).toFixed(2)}deg`,
      );
      element.style.setProperty(
        '--tilt-y',
        `${(state.x * maximumTiltDegrees).toFixed(2)}deg`,
      );
      // O reflexo do vidro anda ao contrário da inclinação.
      element.style.setProperty(
        '--glare-x',
        `${(50 - state.x * 60).toFixed(1)}%`,
      );
      element.style.setProperty(
        '--glare-y',
        `${(30 - state.y * 60).toFixed(1)}%`,
      );

      const settled =
        Math.abs(state.targetX - state.x) < 0.001 &&
        Math.abs(state.targetY - state.y) < 0.001;
      if (!settled) schedule();
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(update);
    };

    host.addEventListener('pointermove', (event) => {
      if (reducedMotion.matches) return;
      const bounds = host.getBoundingClientRect();
      state.targetX = clamp(
        ((event.clientX - bounds.left) / bounds.width - 0.5) * 2,
        -1,
        1,
      );
      state.targetY = clamp(
        ((event.clientY - bounds.top) / bounds.height - 0.5) * 2,
        -1,
        1,
      );
      schedule();
    });
    host.addEventListener('pointerleave', () => {
      state.targetX = 0;
      state.targetY = 0;
      schedule();
    });
  }
}

function initSpotlight() {
  for (const group of document.querySelectorAll('[data-spotlight-group]')) {
    const cards = [...group.querySelectorAll('[data-spotlight]')];
    group.addEventListener('pointermove', (event) => {
      // O foco é um só para o grupo: cada cartão o vê de onde está, e a borda
      // do vizinho acende quando o ponteiro chega perto.
      for (const card of cards) {
        const bounds = card.getBoundingClientRect();
        card.style.setProperty('--spot-x', `${event.clientX - bounds.left}px`);
        card.style.setProperty('--spot-y', `${event.clientY - bounds.top}px`);
      }
    });
  }
}

function initMagnetic() {
  for (const element of document.querySelectorAll('[data-magnetic]')) {
    element.addEventListener('pointermove', (event) => {
      if (reducedMotion.matches) return;
      const bounds = element.getBoundingClientRect();
      const x = event.clientX - (bounds.left + bounds.width / 2);
      const y = event.clientY - (bounds.top + bounds.height / 2);
      element.style.setProperty(
        '--pull-x',
        `${clamp(x * magneticStrength, -magneticLimit, magneticLimit).toFixed(1)}px`,
      );
      element.style.setProperty(
        '--pull-y',
        `${clamp(y * magneticStrength, -magneticLimit, magneticLimit).toFixed(1)}px`,
      );
    });
    element.addEventListener('pointerleave', () => {
      element.style.removeProperty('--pull-x');
      element.style.removeProperty('--pull-y');
    });
  }
}

export function initPointer() {
  if (!finePointer.matches) return;
  initGlow();
  initTilt();
  initSpotlight();
  initMagnetic();
}
