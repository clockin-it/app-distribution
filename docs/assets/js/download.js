// download.js — o redirecionador de download/: um endereço que não muda e
// leva sempre à última versão publicada.
//
//   download/?app=kiosk&platform=macos
//   download/?app=app&platform=linux&format=flatpak
//   download/?app=app&platform=macos&flavor=pilgrims
//
// `app` é app, kiosk ou appadmin; `platform` é macos, windows ou linux. Sem
// `flavor`, vale o clockinit; sem `format`, o formato preferido da plataforma.
// O destino sai do latest.json, e só link de release deste repositório é
// aceito (manifest.js) — o endereço não redireciona para fora.

import { currentLanguage, setLanguage, translate } from './i18n.js';
import { defaultFlavor, findArtifacts, loadManifest } from './manifest.js';

/** O tempo de ler o aviso antes de o download começar. */
const redirectDelayMilliseconds = 800;

const title = document.querySelector('[data-notice-title]');
const text = document.querySelector('[data-notice-text]');
const mark = document.querySelector('[data-notice-mark]');
const link = document.querySelector('[data-notice-link]');
const linkLabel = document.querySelector('[data-notice-link-label]');

function showProblem(key) {
  mark.classList.remove('notice__mark--working');
  title.dataset.i18n = key;
  title.textContent = translate(key);
  text.hidden = true;
  link.hidden = true;
}

async function start() {
  await setLanguage(currentLanguage());
  document.title = translate('redirectTitle');

  const parameters = new URLSearchParams(window.location.search);
  const app = parameters.get('app');
  const platform = parameters.get('platform');
  if (!app || !platform) {
    showProblem('redirectInvalid');
    return;
  }

  let manifest;
  try {
    manifest = await loadManifest();
  } catch (error) {
    console.error(error);
    showProblem('redirectMissing');
    return;
  }

  const [artifact] = findArtifacts(manifest, {
    flavor: parameters.get('flavor') ?? defaultFlavor,
    app,
    platform,
    format: parameters.get('format'),
  });
  if (!artifact) {
    showProblem('redirectMissing');
    return;
  }

  link.href = artifact.url;
  linkLabel.textContent = translate('redirectDirectLink', {
    fileName: artifact.fileName,
  });
  link.hidden = false;
  window.setTimeout(
    () => window.location.replace(artifact.url),
    redirectDelayMilliseconds,
  );
}

start();
