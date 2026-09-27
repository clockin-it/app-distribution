// reveal.js — a entrada em cena: o que sobe ao aparecer na tela, e os títulos
// que chegam palavra por palavra.
//
// No HTML:
//
//   class="reveal"       o elemento sobe e aparece quando entra na tela
//   data-split           o texto é partido em palavras, e cada uma sobe na
//                        sua vez
//   data-split-group     junta vários `data-split` numa entrada só, com as
//                        palavras contadas em sequência (o título da abertura)
//
// O CSS esconde o que ainda não entrou; a classe `is-visible` mostra.

import { reducedMotion } from './motion.js';

/** Quanto do elemento precisa estar na tela para ele entrar em cena. */
const revealThreshold = 0.12;

/**
 * Parte em palavras o texto de cada `data-split`. Roda de novo a cada troca de
 * idioma: a tradução reescreve o texto, e as palavras voltam a ser uma só.
 */
export function splitText() {
  const counters = new Map();

  for (const element of document.querySelectorAll('[data-split]')) {
    const group = element.closest('[data-split-group]') ?? element;
    const words = element.textContent.trim().split(/\s+/).filter(Boolean);
    let index = counters.get(group) ?? 0;

    element.textContent = '';
    element.classList.add('split');
    words.forEach((word, position) => {
      const outer = document.createElement('span');
      const inner = document.createElement('span');
      outer.className = 'split__word';
      inner.className = 'split__inner';
      inner.textContent = word;
      inner.style.setProperty('--word', String(index++));
      outer.append(inner);
      element.append(outer);
      if (position < words.length - 1) element.append(' ');
    });
    counters.set(group, index);
  }
}

export function initReveal() {
  const targets = [
    ...document.querySelectorAll('.reveal, [data-split-group]'),
    ...[...document.querySelectorAll('[data-split]')].filter(
      (element) => element.closest('[data-split-group]') === null,
    ),
  ];

  if (!('IntersectionObserver' in window) || reducedMotion.matches) {
    for (const target of targets) target.classList.add('is-visible');
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
  for (const target of targets) observer.observe(target);
}
