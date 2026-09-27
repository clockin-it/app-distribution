// i18n.js — troca o idioma da página sem recarregar.
//
// O HTML vem em português e marca cada texto com a chave dele:
//
//   <h2 data-i18n="appsTitle">Três apps, um só sistema</h2>
//   <button data-i18n-attr="aria-label:themeLabel">
//
// As traduções moram em assets/i18n/<idioma>.json — a chave é a mesma nos três
// arquivos, em inglês; só o valor muda de língua. O `tools/check.dart` confere
// que os três têm as mesmas chaves e que o português do HTML é o do pt.json.

export const supportedLanguages = ['pt', 'en', 'es'];

const languageStorageKey = 'language';
const messagesByLanguage = new Map();
const listeners = new Set();

let currentMessages = null;

/** O idioma em uso — o boot.js o decide antes de a página aparecer. */
export function currentLanguage() {
  const language = document.documentElement.dataset.language;
  return supportedLanguages.includes(language) ? language : 'pt';
}

/** O código que o `Intl` e o atributo `lang` esperam. */
export function languageTag(language = currentLanguage()) {
  return language === 'pt' ? 'pt-BR' : language;
}

/** As mensagens do idioma em uso, ou `null` antes do primeiro `setLanguage`. */
export function messages() {
  return currentMessages;
}

/** Troca `{name}` pelo valor de mesmo nome. */
export function format(message, values = {}) {
  return message.replace(/\{(\w+)\}/g, (placeholder, name) =>
    name in values ? String(values[name]) : placeholder,
  );
}

/** A mensagem da chave, já com os valores; a própria chave se ela não existe. */
export function translate(key, values) {
  const message = currentMessages?.[key];
  return message === undefined ? key : format(message, values);
}

/** Chama `listener` a cada troca de idioma, com as mensagens novas. */
export function onLanguageChange(listener) {
  listeners.add(listener);
}

function loadMessages(language) {
  if (!messagesByLanguage.has(language)) {
    const url = new URL(`../i18n/${language}.json`, import.meta.url);
    const request = fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error(`could not load ${url.pathname}: HTTP ${response.status}`);
      }
      return response.json();
    });
    // Uma falha não fica guardada: a próxima troca tenta de novo.
    request.catch(() => messagesByLanguage.delete(language));
    messagesByLanguage.set(language, request);
  }
  return messagesByLanguage.get(language);
}

function applyMessages(loaded) {
  for (const element of document.querySelectorAll('[data-i18n]')) {
    const message = loaded[element.dataset.i18n];
    if (message !== undefined) element.textContent = message;
  }
  for (const element of document.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of element.dataset.i18nAttr.split(';')) {
      const [attribute, key] = pair.split(':').map((part) => part.trim());
      if (attribute && loaded[key] !== undefined) {
        element.setAttribute(attribute, loaded[key]);
      }
    }
  }
}

/**
 * Carrega o idioma e o aplica na página. Com `persist`, guarda a escolha no
 * aparelho — é o caso do clique no seletor, e não o da carga da página.
 */
export async function setLanguage(language, { persist = false } = {}) {
  const root = document.documentElement;
  const target = supportedLanguages.includes(language) ? language : 'pt';

  try {
    const loaded = await loadMessages(target);
    currentMessages = loaded;
    root.dataset.language = target;
    root.lang = languageTag(target);
    applyMessages(loaded);

    if (persist) {
      try {
        window.localStorage.setItem(languageStorageKey, target);
      } catch (error) {
        // Sem armazenamento a escolha vale só para esta visita.
      }
    }
    for (const listener of listeners) listener(loaded, target);
  } catch (error) {
    // Sem o arquivo, a página fica no idioma em que está — o português do
    // HTML, na primeira carga.
    console.error(error);
  } finally {
    root.classList.remove('is-translating');
  }
}
