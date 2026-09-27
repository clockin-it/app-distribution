// particles.js — a constelação do fundo da abertura: pontos que vagam
// devagar, ligados por um fio quando se aproximam, e que o ponteiro puxa para
// perto.
//
// É desenhada num <canvas data-particles>. A cor sai do CSS (`--particle`), e
// é relida quando o tema muda. O laço para enquanto a abertura está fora da
// tela ou a aba está escondida, e não liga com "reduzir movimento".

import { reducedMotion, watchVisibility } from './motion.js';

/** Um ponto a cada tantos pixels quadrados de tela, até o teto. */
const areaPerParticle = 15000;
const maximumParticles = 90;

/** A velocidade máxima de um ponto, em pixels por quadro. */
const maximumSpeed = 0.28;

/** Até que distância dois pontos se ligam, e o ponteiro alcança um ponto. */
const linkDistance = 132;
const pointerDistance = 190;

/** Quanto o ponteiro puxa um ponto a cada quadro. */
const pointerPull = 0.012;

/** O raio dos pontos, em pixels. */
const minimumRadius = 1;
const maximumRadius = 2.4;

/** A tela de alta densidade é desenhada no máximo neste fator. */
const maximumPixelRatio = 2;

export function initParticles() {
  const canvas = document.querySelector('[data-particles]');
  if (!canvas || reducedMotion.matches) return;
  const context = canvas.getContext('2d');
  if (!context) return;

  let width = 0;
  let height = 0;
  let color = '100, 187, 70';
  let particles = [];
  let pointer = null;
  let visible = false;
  let running = false;

  const readColor = () => {
    const value = getComputedStyle(canvas).getPropertyValue('--particle').trim();
    if (value) color = value;
  };

  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, maximumPixelRatio);
    width = bounds.width;
    height = bounds.height;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const wanted = Math.min(
      maximumParticles,
      Math.round((width * height) / areaPerParticle),
    );
    particles = Array.from({ length: wanted }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      speedX: (Math.random() * 2 - 1) * maximumSpeed,
      speedY: (Math.random() * 2 - 1) * maximumSpeed,
      radius: minimumRadius + Math.random() * (maximumRadius - minimumRadius),
    }));
  };

  const draw = () => {
    context.clearRect(0, 0, width, height);

    for (const particle of particles) {
      if (pointer) {
        const distanceX = pointer.x - particle.x;
        const distanceY = pointer.y - particle.y;
        const distance = Math.hypot(distanceX, distanceY);
        if (distance < pointerDistance && distance > 1) {
          particle.x += distanceX * pointerPull;
          particle.y += distanceY * pointerPull;
          context.strokeStyle = `rgba(${color}, ${(0.34 * (1 - distance / pointerDistance)).toFixed(3)})`;
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(particle.x, particle.y);
          context.lineTo(pointer.x, pointer.y);
          context.stroke();
        }
      }

      particle.x += particle.speedX;
      particle.y += particle.speedY;
      // Quem sai por um lado volta pelo outro.
      if (particle.x < -10) particle.x = width + 10;
      if (particle.x > width + 10) particle.x = -10;
      if (particle.y < -10) particle.y = height + 10;
      if (particle.y > height + 10) particle.y = -10;
    }

    for (let first = 0; first < particles.length; first++) {
      const a = particles[first];
      for (let second = first + 1; second < particles.length; second++) {
        const b = particles[second];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (distance >= linkDistance) continue;
        context.strokeStyle = `rgba(${color}, ${(0.22 * (1 - distance / linkDistance)).toFixed(3)})`;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.stroke();
      }
      context.fillStyle = `rgba(${color}, 0.55)`;
      context.beginPath();
      context.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
      context.fill();
    }
  };

  const loop = () => {
    if (!visible || document.hidden || reducedMotion.matches) {
      running = false;
      return;
    }
    draw();
    window.requestAnimationFrame(loop);
  };
  const start = () => {
    if (running) return;
    running = true;
    window.requestAnimationFrame(loop);
  };

  const host = canvas.closest('[data-pointer-host]') ?? canvas;
  host.addEventListener('pointermove', (event) => {
    const bounds = canvas.getBoundingClientRect();
    pointer = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  });
  host.addEventListener('pointerleave', () => {
    pointer = null;
  });

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', start);
  document.addEventListener('themechange', readColor);
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', readColor);
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) context.clearRect(0, 0, width, height);
    else start();
  });

  readColor();
  resize();
  watchVisibility(canvas, (isVisible) => {
    visible = isVisible;
    if (isVisible) start();
  });
}
