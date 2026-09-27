// demo.js — a encenação da abertura: o relógio que anda, e o app que bate um
// ponto sozinho, em laço.
//
// O laço passa por quatro estados, escritos em `data-demo-state` no palco; o
// CSS faz o resto — o botão afunda, a câmera abre, a confirmação sobe:
//
//   idle      a home, parada
//   press     o toque no botão de ponto
//   scan      a leitura do rosto
//   success   a confirmação, com a hora da batida
//
// Na volta ao `idle`, a hora entra na fileira dos últimos registros. Com
// "reduzir movimento", o laço não roda e o relógio anda de minuto em minuto.

import { languageTag } from '../i18n.js';
import { reducedMotion, watchVisibility } from './motion.js';

/** Quanto dura cada estado, em milissegundos. */
const stateDurations = {
  idle: 3200,
  press: 520,
  scan: 2100,
  success: 2400,
};

const stateOrder = ['idle', 'press', 'scan', 'success'];

/** Quantas horas cabem na fileira dos últimos registros. */
const maximumEntries = 4;

function format(options) {
  return new Intl.DateTimeFormat(languageTag(), options).format(new Date());
}

/** A hora como o app a mostra na batida: 08:02. */
function shortTime() {
  return format({ hour: '2-digit', minute: '2-digit', hour12: false });
}

/** Escreve a data e a hora nos mostradores da página. */
export function updateClock() {
  const write = (selector, text) => {
    for (const element of document.querySelectorAll(selector)) {
      element.textContent = text;
    }
  };
  write('[data-clock-weekday]', format({ weekday: 'long' }));
  write('[data-clock-date]', format({ day: 'numeric', month: 'long' }));
  write('[data-clock-month]', format({ month: 'long', year: 'numeric' }));
  write('[data-clock-short]', shortTime());
  write(
    '[data-clock-time]',
    format({
      hour: '2-digit',
      minute: '2-digit',
      second: reducedMotion.matches ? undefined : '2-digit',
      hour12: false,
    }),
  );
}

export function initDemo() {
  updateClock();
  window.setInterval(updateClock, 1000);

  const stage = document.querySelector('[data-demo]');
  if (!stage) return;
  const entries = stage.querySelector('[data-demo-entries]');
  const times = [...stage.querySelectorAll('[data-demo-time]')];

  let visible = false;
  let timer = null;
  let punchTime = null;

  const enter = (state) => {
    stage.dataset.demoState = state;

    if (state === 'success') {
      punchTime = shortTime();
      for (const element of times) element.textContent = punchTime;
    }
    if (state === 'idle' && punchTime !== null && entries) {
      // A batida entra na frente da fileira, e a mais velha sai pelo fim.
      const entry = document.createElement('span');
      entry.className = 'mock-entry is-new';
      entry.textContent = punchTime;
      entries.prepend(entry);
      while (entries.children.length > maximumEntries) {
        entries.lastElementChild.remove();
      }
      punchTime = null;
    }
  };

  const advance = () => {
    timer = null;
    if (!visible || document.hidden || reducedMotion.matches) return;
    const current = stateOrder.indexOf(stage.dataset.demoState);
    const next = stateOrder[(current + 1) % stateOrder.length];
    enter(next);
    timer = window.setTimeout(advance, stateDurations[next]);
  };

  const resume = () => {
    if (timer !== null || reducedMotion.matches) return;
    timer = window.setTimeout(advance, stateDurations[stage.dataset.demoState]);
  };

  document.addEventListener('visibilitychange', resume);
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) enter('idle');
    else resume();
  });
  watchVisibility(stage, (isVisible) => {
    visible = isVisible;
    if (isVisible) resume();
  });
}
