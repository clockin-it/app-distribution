// boot.js — roda no <head>, antes do primeiro desenho da página: avisa o CSS de
// que há JavaScript (é o que libera as animações de entrada) e aplica o tema e
// o idioma escolhidos, para a página não piscar no tema ou no idioma errado.
//
// É o único script clássico do site: os outros são módulos, e módulo só roda
// depois de o HTML ser lido. A ordem de quem decide, no tema e no idioma:
//
//   1. a URL (`?theme=dark`, `?lang=en`) — serve para link e para teste;
//   2. a escolha guardada no aparelho (os botões do cabeçalho);
//   3. o sistema — `prefers-color-scheme` e o idioma do navegador.
(function () {
  'use strict';

  var supportedLanguages = ['pt', 'en', 'es'];
  // O idioma de quem chega com um navegador em francês ou alemão: o inglês
  // atende mais gente do que o português.
  var fallbackLanguage = 'en';

  var root = document.documentElement;
  var parameters = new URLSearchParams(window.location.search);

  // O localStorage lança em aba anônima e com os dados do site bloqueados.
  function stored(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function browserLanguage() {
    var preferred = navigator.languages || [navigator.language || ''];
    for (var index = 0; index < preferred.length; index++) {
      var code = String(preferred[index]).slice(0, 2).toLowerCase();
      if (supportedLanguages.indexOf(code) >= 0) return code;
    }
    return fallbackLanguage;
  }

  root.classList.add('js');

  var theme = parameters.get('theme') || stored('theme');
  if (theme === 'light' || theme === 'dark') {
    root.setAttribute('data-theme', theme);
  }

  var language = parameters.get('lang') || stored('language');
  if (supportedLanguages.indexOf(language) < 0) language = browserLanguage();
  root.setAttribute('data-language', language);
  root.lang = language === 'pt' ? 'pt-BR' : language;

  // O HTML vem em português. Em outro idioma, a página fica escondida até as
  // traduções chegarem — o i18n.js tira a classe, e o CSS a tira sozinho
  // depois de um tempo se o arquivo não vier.
  if (language !== 'pt') root.classList.add('is-translating');
})();
