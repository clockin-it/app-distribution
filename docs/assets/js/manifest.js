// manifest.js — lê o latest.json, o manifesto com a última versão publicada de
// cada app em cada plataforma.
//
// Quem o escreve é o script de publicação do repositório dos apps
// (clockin-it/app), a cada release. A página e o redirecionador de
// download/ só o leem. O formato está no README do repositório.

/** A versão do formato que este código entende. */
const supportedSchemaVersion = 1;

/**
 * Só link de release deste repositório vira botão de download. O manifesto é
 * nosso, mas a conferida custa uma linha: um latest.json adulterado não
 * consegue apontar a página para um arquivo de fora.
 */
const trustedUrlPrefix =
  'https://github.com/clockin-it/app-distribution/releases/download/';

/** O flavor que a página mostra. Os outros saem só por link direto. */
export const defaultFlavor = 'clockinit';

/**
 * Com mais de um formato na plataforma, o primeiro da lista é o botão. No
 * macOS só há o DMG: o `.pkg` dos apps é o da Mac App Store, e não sai daqui.
 */
const formatPreference = {
  macos: ['dmg'],
  windows: ['exe', 'msix', 'msi'],
  linux: ['appimage', 'flatpak', 'deb', 'rpm'],
};

/** Os nomes de exibição das plataformas — iguais nos três idiomas. */
export const platformNames = {
  android: 'Android',
  ios: 'iOS',
  macos: 'macOS',
  windows: 'Windows',
  linux: 'Linux',
};

let manifestRequest = null;

/** O manifesto, pedido uma vez só por página. Lança se não vier ou não servir. */
export function loadManifest() {
  if (manifestRequest === null) {
    const url = new URL('../../latest.json', import.meta.url);
    // `no-cache` revalida com o servidor: o GitHub Pages manda o arquivo com
    // dez minutos de cache, e a release nova precisa aparecer antes disso.
    manifestRequest = fetch(url, { cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`could not load latest.json: HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((manifest) => {
        if (
          manifest.schemaVersion !== supportedSchemaVersion ||
          !Array.isArray(manifest.artifacts)
        ) {
          throw new Error('latest.json has an unsupported format');
        }
        return manifest;
      });
  }
  return manifestRequest;
}

function isTrustedUrl(url) {
  return typeof url === 'string' && url.startsWith(trustedUrlPrefix);
}

function preferenceOf(artifact) {
  const order = formatPreference[artifact.platform] ?? [];
  const index = order.indexOf(String(artifact.format).toLowerCase());
  return index < 0 ? order.length : index;
}

/**
 * Os artefatos publicados do app na plataforma, o preferido primeiro. Vazio
 * quando ainda não há release daquela combinação.
 */
export function findArtifacts(
  manifest,
  { flavor = defaultFlavor, app, platform, format = null },
) {
  return manifest.artifacts
    .filter(
      (artifact) =>
        artifact.flavor === flavor &&
        artifact.app === app &&
        artifact.platform === platform &&
        (format === null ||
          String(artifact.format).toLowerCase() === format.toLowerCase()) &&
        isTrustedUrl(artifact.url),
    )
    .sort((left, right) => preferenceOf(left) - preferenceOf(right));
}

/** O tamanho do arquivo como se lê: "84 MB", no idioma pedido. */
export function formatSize(bytes, locale) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  const megabytes = bytes / (1024 * 1024);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: 'megabyte',
      maximumFractionDigits: megabytes < 10 ? 1 : 0,
    }).format(megabytes);
  } catch (error) {
    return `${Math.round(megabytes)} MB`;
  }
}
