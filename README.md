# app-distribution

A distribuição pública dos apps do **clockin.it**: a página de apresentação e
download, e os instaladores de computador, publicados como *releases* deste
repositório.

| O que | Onde |
|---|---|
| a página | [docs/](docs/), servida pelo GitHub Pages em <https://clockin-it.github.io/app-distribution/> |
| os instaladores | as [releases](https://github.com/clockin-it/app-distribution/releases) — um `.dmg` por app, e o que vier de Windows e Linux. O que é de loja (`.aab`, `.ipa`, o `.pkg` da Mac App Store) não entra aqui |
| a última versão de cada um | [docs/latest.json](docs/latest.json), o manifesto que a página lê |

O código dos apps **não** mora aqui: fica em `clockin-it/app`, que é privado. É
de lá que sai o script que cria a release, sobe os instaladores e reescreve o
`latest.json` — ninguém edita o manifesto à mão.

## Os três apps

| App | Para quem | Nome nos arquivos |
|---|---|---|
| clockin.it | o colaborador, que registra o próprio ponto | `app` |
| clockin.it kiosk | o ponto compartilhado, num terminal para a equipe | `kiosk` |
| clockin.it admin | o gestor, que cadastra colaboradores, faces e kiosks | `appadmin` |

Android e iOS saem pelas lojas (Google Play e TestFlight); a página só aponta
para elas. O que este repositório hospeda é o instalador de computador.

## Como a página acha a última versão

Cada release leva os instaladores com **nome fixo** — o mesmo de uma versão
para a outra:

```
<flavor>-<app>-<plataforma>.<formato>        clockinit-kiosk-macos.dmg
```

E o script de publicação grava, no `docs/latest.json`, uma entrada por
combinação de flavor, app, plataforma e formato:

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-09-27T18:00:00Z",
  "artifacts": [
    {
      "flavor": "clockinit",
      "app": "kiosk",
      "platform": "macos",
      "format": "dmg",
      "version": "2.1.7",
      "buildNumber": 205,
      "tag": "v2.1.7+205",
      "fileName": "clockinit-kiosk-macos.dmg",
      "url": "https://github.com/clockin-it/app-distribution/releases/download/v2.1.7%2B205/clockinit-kiosk-macos.dmg",
      "size": 93184000,
      "sha256": "…",
      "publishedAt": "2026-09-27T18:00:00Z"
    }
  ]
}
```

A página lê esse arquivo e liga o botão de cada plataforma que ele tem, com a
versão e o tamanho. Plataforma que ainda não tem entrada aparece como *Em
breve* — uma plataforma nova entra na página sem ninguém mexer no HTML.

O manifesto é **por combinação**, e não por release, de propósito: os
instaladores de Windows e de Linux saem de outras máquinas, em outra hora. Se a
página seguisse a "última release" do GitHub, o botão do macOS quebraria no
intervalo em que a release nova só tem o instalador do Windows.

### Os endereços que não mudam

Para pôr num e-mail, num manual ou dentro do app:

| Endereço | Leva a |
|---|---|
| `…/app-distribution/download/?app=kiosk&platform=macos` | a última versão do app na plataforma, pelo manifesto |
| `…&format=flatpak` | um formato específico, quando a plataforma tem mais de um |
| `…&flavor=pilgrims` | outro flavor — sem o parâmetro, vale o `clockinit` |
| `github.com/clockin-it/app-distribution/releases/latest/download/clockinit-kiosk-macos.dmg` | o mesmo arquivo, pelo GitHub — só funciona quando a **última** release tem aquele instalador |

`app` é `app`, `kiosk` ou `appadmin`; `platform` é `macos`, `windows` ou
`linux`.

Os dois primeiros só aceitam link de release **deste** repositório: o endereço
de download não redireciona para fora, mesmo com um manifesto adulterado.

### Os flavors

A página mostra o flavor `clockinit`. Os instaladores dos outros flavors de
produção sobem para as mesmas releases, com o flavor no nome
(`pilgrims-app-macos.dmg`), e saem pelo endereço com `&flavor=`.

## Mexer na página

A página é estática e não tem etapa de build: HTML, CSS e JavaScript escritos à
mão, sem framework e sem nada carregado de terceiros — nem fonte.

```
docs/
  index.html              a home
  download/index.html     o redirecionador dos endereços que não mudam
  404.html                a página do endereço que não existe
  latest.json             o manifesto (escrito pelo script de publicação)
  assets/css/site.css     o estilo; cor e medida saem das variáveis do :root
  assets/js/boot.js       tema e idioma, antes de a página aparecer
  assets/js/site.js       a home: efeitos de rolagem e botões de download
  assets/js/download.js   o redirecionador
  assets/js/i18n.js       a troca de idioma
  assets/js/manifest.js   a leitura do latest.json
  assets/i18n/*.json      os textos: pt, en e es
  assets/img/             logo, ícones dos apps e a imagem de compartilhamento
tools/
  serve.dart              serve docs/ em http://localhost:8080
  check.dart              confere textos, links, manifesto e política de segurança
  screenshot.dart         fotografa a página nos dois temas e em duas larguras
```

### Ver antes de publicar

As ferramentas são Dart, sem pubspec — basta ter o `dart` (vem com o Flutter).

```bash
dart tools/serve.dart                 # http://localhost:8080
dart tools/check.dart                 # "ok", ou a lista do que achou
dart tools/screenshot.dart            # imagens em build/screenshots/
```

A página não abre direto do arquivo (`file://`): os scripts são módulos e o
manifesto é lido por `fetch`, e o navegador barra os dois fora do `http`.

Para ver a página **com versões publicadas** sem mexer no manifesto real:

```bash
dart tools/serve.dart --manifest tools/fixtures/latest.sample.json
```

O exemplo traz, de propósito, um instalador de Windows com link de fora deste
repositório — na página ele tem de continuar *Em breve*.

Tema e idioma pela URL, para testar e para link:

```
http://localhost:8080/?theme=dark&lang=en      theme: light | dark · lang: pt | en | es
```

### O que conferir numa alteração visual

- **os dois temas** — o botão do cabeçalho alterna entre automático, claro e
  escuro;
- **celular e computador** — a largura de 390 px e a de 1440 px são as do
  `screenshot.dart`;
- **os três idiomas** — o texto em inglês e em espanhol é mais comprido;
- **movimento reduzido** — `dart tools/screenshot.dart --reduced-motion`, ou a
  opção do sistema: nada desliza, nada flutua, e o parallax não liga.

### Texto novo

O HTML é escrito em português e marca cada texto com a chave dele
(`data-i18n="appsTitle"`). A chave é em inglês e é a mesma nos três arquivos de
`assets/i18n/`; só o valor muda de língua. Texto novo entra no HTML **e** nos
três arquivos — o `check.dart` acusa a chave que falta, a que sobra e o
português do HTML que divergiu do `pt.json`.

### As regras da página

- **Nada de terceiros.** Sem fonte, script, estilo ou imagem de outro domínio. A
  política de segurança (`Content-Security-Policy`, no `<head>`) barra o que
  escapar.
- **Sem `style=""` e sem script embutido no HTML** — a mesma política os barra,
  em silêncio. Estilo calculado (o parallax) é escrito pelo JavaScript.
- **Cor e medida têm nome**: saem das variáveis do `:root` do `site.css`. O
  tema escuro só troca o valor delas — e o bloco dele aparece duas vezes (o do
  sistema e o da escolha); mudou num, mude no outro.
- **Todo movimento respeita `prefers-reduced-motion`.**
- **Identificador em inglês, prosa em português** — classe, chave e nome de
  arquivo em inglês; comentário e este README em português.

## Publicar

O GitHub Pages serve a pasta `docs/` da branch `main`: o que entra na `main`
está no ar em um ou dois minutos. Alteração na página chega por *pull request*;
o `latest.json` é escrito direto na `main` pelo script de publicação.

## Marcas

O logo e os ícones são do clockin.it. Android, Google Play, iOS, TestFlight,
macOS, Windows e Linux são marcas dos respectivos donos, citadas aqui para
dizer onde cada app roda.
