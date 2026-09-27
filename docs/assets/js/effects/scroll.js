// scroll.js — tudo o que acompanha a rolagem: o cabeçalho, a barra e o aro de
// progresso, o parallax, o trilho dos passos e o ponteiro da faixa.
//
// No HTML:
//
//   data-parallax-host     a seção que serve de referência às camadas dela
//   data-parallax="-0.3"   a camada, e quanto ela anda por pixel que a seção
//                          se afasta do meio da tela
//   data-pointer-host      a seção que escuta o ponteiro
//   data-pointer="24"      quanto a camada anda, em pixels, com o ponteiro na
//                          borda da seção
//
// Um laço só, no ritmo da tela (`requestAnimationFrame`). Ele roda enquanto há
// o que atualizar — a rolagem mudou, ou o ponteiro ainda não chegou ao alvo —
// e para sozinho.

import { clamp, finePointer, lerp, reducedMotion } from './motion.js';

/** Quanto o parallax do ponteiro se aproxima do alvo a cada quadro (0 a 1). */
const pointerEasing = 0.08;

/** A rolagem, em pixels, a partir da qual o cabeçalho ganha fundo. */
const headerScrollThreshold = 12;

/** A rolagem, em pixels, a partir da qual a volta ao topo aparece. */
const toTopScrollThreshold = 600;

/** A seção conta como atual quando o topo dela passa desta altura da tela. */
const currentSectionLine = 0.4;

/** Quantas voltas o ponteiro da faixa dá enquanto ela atravessa a tela. */
const bandHandTurns = 1.5;

export function initScroll() {
  const root = document.documentElement;
  const header = document.querySelector('[data-header]');
  const toTop = document.querySelector('[data-to-top]');
  const band = document.querySelector('[data-band]');
  const steps = document.querySelector('[data-steps]');
  const stepItems = steps ? [...steps.querySelectorAll('[data-step]')] : [];

  const navigation = document.querySelector('.site-nav');
  const marker = document.querySelector('[data-nav-marker]');
  const links = navigation ? [...navigation.querySelectorAll('a')] : [];
  const sections = links
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  const layers = [...document.querySelectorAll('[data-parallax]')].map(
    (element) => ({
      element,
      host: element.closest('[data-parallax-host]'),
      followsPointer: element.closest('[data-pointer-host]') !== null,
      scrollFactor: Number(element.dataset.parallax) || 0,
      pointerRange: Number(element.dataset.pointer) || 0,
    }),
  );

  // A posição de cada anfitrião no documento, medida fora do laço: ler o
  // layout a cada quadro custa caro.
  const hostMetrics = new Map();
  const measure = () => {
    hostMetrics.clear();
    for (const { host } of layers) {
      if (!host || hostMetrics.has(host)) continue;
      const bounds = host.getBoundingClientRect();
      hostMetrics.set(host, {
        top: bounds.top + window.scrollY,
        height: bounds.height,
      });
    }
  };

  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  let currentLink = null;
  let scheduled = false;

  const moveMarker = (link) => {
    if (link === currentLink) return;
    currentLink = link;
    for (const item of links) item.classList.toggle('is-current', item === link);
    if (!marker) return;
    if (link === null) {
      marker.classList.remove('is-visible');
      return;
    }
    marker.style.setProperty('--marker-x', `${link.offsetLeft}px`);
    marker.style.setProperty('--marker-width', `${link.offsetWidth}px`);
    marker.classList.add('is-visible');
  };

  const update = () => {
    scheduled = false;
    const scrollY = window.scrollY;
    const viewport = window.innerHeight;
    const scrollable = root.scrollHeight - viewport || 1;
    const progress = clamp(scrollY / scrollable, 0, 1);

    root.style.setProperty('--scroll-progress', progress.toFixed(4));
    header?.classList.toggle('is-scrolled', scrollY > headerScrollThreshold);
    toTop?.classList.toggle('is-visible', scrollY > toTopScrollThreshold);

    // A seção em que a pessoa está, marcada no menu.
    let current = null;
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= viewport * currentSectionLine) {
        current = section;
      }
    }
    moveMarker(
      current === null
        ? null
        : (links.find(
            (link) => link.getAttribute('href') === `#${current.id}`,
          ) ?? null),
    );

    if (steps) {
      // O trilho enche enquanto a lista atravessa o meio da tela.
      const bounds = steps.getBoundingClientRect();
      const start = viewport * 0.8;
      const end = viewport * 0.35;
      const filled = reducedMotion.matches
        ? 1
        : clamp(
            (start - bounds.top) / (start - end + bounds.height * 0.3),
            0,
            1,
          );
      steps.style.setProperty('--steps-progress', filled.toFixed(4));
      stepItems.forEach((item, index) => {
        const threshold = index / Math.max(1, stepItems.length - 1);
        item.classList.toggle('is-active', filled >= threshold * 0.98 - 0.001);
      });
    }

    if (band && !reducedMotion.matches) {
      // De 0, com a faixa entrando por baixo, a 1, com ela saindo por cima.
      const bounds = band.getBoundingClientRect();
      const crossed = clamp(
        (viewport - bounds.top) / (viewport + bounds.height),
        0,
        1,
      );
      band.style.setProperty(
        '--band-turn',
        `${(crossed * bandHandTurns).toFixed(4)}turn`,
      );
    }

    if (reducedMotion.matches) return;

    pointer.x = lerp(pointer.x, pointer.targetX, pointerEasing);
    pointer.y = lerp(pointer.y, pointer.targetY, pointerEasing);
    const settled =
      Math.abs(pointer.targetX - pointer.x) < 0.001 &&
      Math.abs(pointer.targetY - pointer.y) < 0.001;

    for (const layer of layers) {
      const metrics = hostMetrics.get(layer.host);
      if (!metrics) continue;
      const hostTop = metrics.top - scrollY;
      if (hostTop > viewport || hostTop + metrics.height < 0) continue;

      // A distância do meio do anfitrião ao meio da tela: zero quando ele está
      // centrado, e é aí que cada camada fica no lugar em que foi desenhada.
      const offset = hostTop + metrics.height / 2 - viewport / 2;
      const shiftX = layer.followsPointer ? pointer.x * layer.pointerRange : 0;
      const shiftY =
        offset * layer.scrollFactor +
        (layer.followsPointer ? pointer.y * layer.pointerRange * 0.6 : 0);
      layer.element.style.transform = `translate3d(${shiftX.toFixed(2)}px, ${shiftY.toFixed(2)}px, 0)`;
    }

    if (!settled) schedule();
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(update);
  };

  const remeasure = () => {
    measure();
    currentLink = undefined;
    schedule();
  };

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', remeasure);
  window.addEventListener('load', remeasure);

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

  // O texto muda de tamanho com o idioma, e o marcador do menu acompanha.
  return { refresh: remeasure };
}
