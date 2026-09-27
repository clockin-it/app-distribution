// motion.js — o que os efeitos dividem: as preferências de quem visita e duas
// contas.
//
// Todo efeito de movimento confere `reducedMotion` antes de ligar. Quem liga
// "reduzir movimento" no sistema vê a página parada: nada desliza, nada
// flutua, e o que andaria com a rolagem fica no lugar em que foi desenhado.

export const reducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)',
);

/** Mouse ou trackpad: quem tem ponteiro que paira sobre as coisas. */
export const finePointer = window.matchMedia(
  '(hover: hover) and (pointer: fine)',
);

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

/** Anda de `from` para `to` a fração `amount` do caminho. */
export function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

/**
 * Chama `onChange(visible)` quando o elemento entra e sai da tela — é o que
 * deixa um efeito caro (o canvas, o laço da encenação) parar enquanto ninguém
 * o vê.
 */
export function watchVisibility(element, onChange) {
  if (!('IntersectionObserver' in window)) {
    onChange(true);
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) onChange(entry.isIntersecting);
  });
  observer.observe(element);
}
