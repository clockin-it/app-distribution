// check.dart — confere o site de docs/ antes de publicar. Só `dart:io` e
// `dart:convert`: sem pubspec e sem `pub get`.
//
// Rodar, da raiz do repositório:
//
//   dart tools/check.dart
//
// Sai com 0 e "ok" quando está tudo certo; com 1 e a lista do que achou quando
// não está. O que ele confere:
//
//   1. os três arquivos de assets/i18n/ têm as mesmas chaves, e nenhuma vazia;
//   2. toda chave de `data-i18n` e de `data-i18n-attr` do HTML existe;
//   3. o português escrito no HTML é o do pt.json — é o texto de quem chega
//      sem JavaScript, e os dois não podem divergir;
//   4. toda chave dos arquivos de idioma é usada, no HTML ou num script;
//   5. o latest.json (e o exemplo de tools/fixtures/) está no formato que a
//      página lê, e todo link aponta para uma release deste repositório;
//   6. nenhuma página com a política `style-src 'self'` tem `style=""` ou
//      script embutido — o navegador os barraria em silêncio;
//   7. todo arquivo local que o HTML referencia existe.

import 'dart:convert';
import 'dart:io';

const _languages = ['pt', 'en', 'es'];

/// O idioma em que o HTML é escrito.
const _sourceLanguage = 'pt';

const _supportedSchemaVersion = 1;

const _trustedUrlPrefix =
    'https://github.com/clockin-it/app-distribution/releases/download/';

const _artifactStringFields = [
  'flavor',
  'app',
  'platform',
  'format',
  'version',
  'tag',
  'fileName',
  'url',
  'sha256',
  'publishedAt',
];

const _artifactIntegerFields = ['buildNumber', 'size'];

const _apps = ['app', 'kiosk', 'appadmin'];

const _platforms = ['macos', 'windows', 'linux'];

final _problems = <String>[];

void _problem(String where, String message) =>
    _problems.add('$where: $message');

void main() {
  // tools/check.dart -> a raiz do repositório é a pasta de cima de tools/.
  final repositoryRoot = File.fromUri(Platform.script).parent.parent.path;
  final siteRoot = '$repositoryRoot/docs';

  final messages = _readMessages(siteRoot);
  final htmlFiles = _filesOf(siteRoot, '.html');
  final scriptFiles = _filesOf(siteRoot, '.js');

  final usedKeys = <String>{};
  for (final file in htmlFiles) {
    final name = _relative(file.path, repositoryRoot);
    // Sem os comentários: o que eles citam de HTML não é a página.
    final html = file.readAsStringSync().replaceAll(
      RegExp(r'<!--.*?-->', dotAll: true),
      '',
    );
    usedKeys.addAll(_checkTranslatedText(name, html, messages));
    _checkContentSecurity(name, html);
    _checkLocalReferences(name, html, file.parent.path, siteRoot);
  }

  final scripts = scriptFiles.map((file) => file.readAsStringSync()).join('\n');
  final sourceMessages = messages[_sourceLanguage] ?? const {};
  for (final key in sourceMessages.keys) {
    final usedInScript = scripts.contains("'$key'");
    if (!usedKeys.contains(key) && !usedInScript) {
      _problem('assets/i18n', 'key "$key" is not used by any page or script');
    }
  }

  _checkManifest('$siteRoot/latest.json', repositoryRoot, strictUrls: true);
  // O exemplo traz de propósito um link de fora, para exercitar a recusa da
  // página: nele só o formato é conferido.
  _checkManifest(
    '$repositoryRoot/tools/fixtures/latest.sample.json',
    repositoryRoot,
    strictUrls: false,
  );

  if (_problems.isEmpty) {
    stdout.writeln(
      'ok: ${htmlFiles.length} pages, ${sourceMessages.length} messages in '
      '${_languages.length} languages, manifest valid',
    );
    return;
  }
  for (final problem in _problems) {
    stderr.writeln('error: $problem');
  }
  stderr.writeln('\n${_problems.length} problem(s) found');
  exitCode = 1;
}

List<File> _filesOf(String directory, String extension) =>
    Directory(directory)
        .listSync(recursive: true)
        .whereType<File>()
        .where((file) => file.path.endsWith(extension))
        .toList()
      ..sort((left, right) => left.path.compareTo(right.path));

String _relative(String path, String root) =>
    path.startsWith('$root/') ? path.substring(root.length + 1) : path;

Map<String, Map<String, String>> _readMessages(String siteRoot) {
  final messages = <String, Map<String, String>>{};
  for (final language in _languages) {
    final name = 'assets/i18n/$language.json';
    final file = File('$siteRoot/$name');
    if (!file.existsSync()) {
      _problem(name, 'file not found');
      continue;
    }
    try {
      final json = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
      messages[language] = {
        for (final entry in json.entries) entry.key: '${entry.value}',
      };
      for (final entry in json.entries) {
        if (entry.value is! String || (entry.value as String).trim().isEmpty) {
          _problem(name, 'key "${entry.key}" is empty or not a text');
        }
      }
    } on Object catch (error) {
      _problem(name, 'invalid JSON: $error');
    }
  }

  final source = messages[_sourceLanguage];
  if (source == null) return messages;
  for (final language in _languages) {
    final other = messages[language];
    if (other == null || language == _sourceLanguage) continue;
    final name = 'assets/i18n/$language.json';
    for (final key in source.keys) {
      if (!other.containsKey(key)) _problem(name, 'missing key "$key"');
    }
    for (final key in other.keys) {
      if (!source.containsKey(key)) {
        _problem(name, 'key "$key" does not exist in $_sourceLanguage.json');
      }
    }
    // O mesmo `{name}` nos três idiomas: uma tradução que perde o placeholder
    // mostra a chave crua para quem visita.
    for (final key in source.keys) {
      final expected = _placeholders(source[key]!);
      final found = _placeholders(other[key] ?? '');
      if (other.containsKey(key) && expected.join(',') != found.join(',')) {
        _problem(
          name,
          'key "$key" has placeholders $found, expected $expected',
        );
      }
    }
  }
  return messages;
}

List<String> _placeholders(String message) =>
    RegExp(r'\{(\w+)\}')
        .allMatches(message)
        .map((match) => match.group(1)!)
        .toSet()
        .toList()
      ..sort();

String _decodeEntities(String text) => text
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&nbsp;', ' ');

/// Confere as chaves e o texto em português da página, e devolve as chaves que
/// ela usa.
Set<String> _checkTranslatedText(
  String name,
  String html,
  Map<String, Map<String, String>> messages,
) {
  final source = messages[_sourceLanguage] ?? const <String, String>{};
  final used = <String>{};

  // <tag … data-i18n="key" …>texto</tag>, com o texto sem outra tag dentro.
  final textPattern = RegExp(
    r'<(\w+)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>([^<]*)</\1>',
    multiLine: true,
  );
  final keyPattern = RegExp(r'\bdata-i18n="([^"]+)"');
  final checkedKeys = <String>{};

  for (final match in textPattern.allMatches(html)) {
    final key = match.group(2)!;
    final text = _decodeEntities(match.group(3)!).trim();
    checkedKeys.add(key);
    final expected = source[key];
    if (expected != null && text != expected) {
      _problem(
        name,
        'text of "$key" differs from $_sourceLanguage.json: '
        '"$text" != "$expected"',
      );
    }
  }
  for (final match in keyPattern.allMatches(html)) {
    final key = match.group(1)!;
    used.add(key);
    if (!source.containsKey(key)) {
      _problem(name, 'data-i18n="$key" has no message');
    } else if (!checkedKeys.contains(key)) {
      _problem(
        name,
        'data-i18n="$key" is on an element with other elements inside — '
        'the translation would erase them',
      );
    }
  }

  // <tag … atributo="valor" … data-i18n-attr="atributo:key;…" …>
  final tagPattern = RegExp(r'<\w+\b[^>]*\bdata-i18n-attr="([^"]+)"[^>]*>');
  for (final match in tagPattern.allMatches(html)) {
    final tag = match.group(0)!;
    for (final pair in match.group(1)!.split(';')) {
      final parts = pair.split(':').map((part) => part.trim()).toList();
      if (parts.length != 2 || parts.any((part) => part.isEmpty)) {
        _problem(name, 'malformed data-i18n-attr: "$pair"');
        continue;
      }
      final attribute = parts[0];
      final key = parts[1];
      used.add(key);
      final expected = source[key];
      if (expected == null) {
        _problem(name, 'data-i18n-attr key "$key" has no message');
        continue;
      }
      final value = RegExp('\\s${RegExp.escape(attribute)}="([^"]*)"')
          .firstMatch(tag)
          ?.group(1);
      if (value == null) {
        _problem(name, 'attribute "$attribute" of "$key" is not in the tag');
      } else if (_decodeEntities(value) != expected) {
        _problem(
          name,
          'attribute "$attribute" of "$key" differs from '
          '$_sourceLanguage.json: "$value" != "$expected"',
        );
      }
    }
  }
  return used;
}

void _checkContentSecurity(String name, String html) {
  final policy = RegExp(
    r'''http-equiv="Content-Security-Policy"\s+content="([^"]+)"''',
  ).firstMatch(html)?.group(1);
  if (policy == null) {
    _problem(name, 'no Content-Security-Policy');
    return;
  }

  // A 404 se basta, com estilo embutido e a política dela.
  final allowsInlineStyle = RegExp(r"style-src[^;]*'unsafe-inline'")
      .hasMatch(policy);
  if (!allowsInlineStyle) {
    if (RegExp(r'<[^>]+\sstyle="').hasMatch(html)) {
      _problem(name, 'style="" attribute, blocked by the policy');
    }
    if (RegExp(r'<style\b').hasMatch(html)) {
      _problem(name, '<style> element, blocked by the policy');
    }
  }
  for (final match in RegExp(r'<script\b([^>]*)>').allMatches(html)) {
    if (!match.group(1)!.contains('src=')) {
      _problem(name, 'inline <script>, blocked by the policy');
    }
  }
  if (RegExp(r'<[^>]+\son\w+="').hasMatch(html)) {
    _problem(name, 'inline event handler (on…=""), blocked by the policy');
  }
}

void _checkLocalReferences(
  String name,
  String html,
  String pageDirectory,
  String siteRoot,
) {
  final pattern = RegExp(r'<(?!use\b)\w+\b[^>]*?\s(?:src|href)="([^"]+)"');
  for (final match in pattern.allMatches(html)) {
    final reference = match.group(1)!;
    if (reference.startsWith('#') ||
        reference.contains(':') ||
        reference.startsWith('//')) {
      continue;
    }
    final path = reference.split('#').first.split('?').first;
    if (path.isEmpty) continue;

    var target = path.startsWith('/')
        ? '$siteRoot$path'
        : '$pageDirectory/$path';
    if (FileSystemEntity.isDirectorySync(target)) {
      target = '$target/index.html';
    }
    if (!File(target).existsSync()) {
      _problem(name, 'reference to a file that does not exist: $reference');
    }
  }

  // Todo <use href="#id"> tem o <symbol id="id"> na mesma página.
  final symbols = RegExp(r'<symbol\b[^>]*\bid="([^"]+)"')
      .allMatches(html)
      .map((match) => match.group(1))
      .toSet();
  for (final match in RegExp(
    r'<use\b[^>]*\bhref="#([^"]+)"',
  ).allMatches(html)) {
    if (!symbols.contains(match.group(1))) {
      _problem(name, '<use href="#${match.group(1)}"> has no <symbol>');
    }
  }
}

void _checkManifest(
  String path,
  String repositoryRoot, {
  required bool strictUrls,
}) {
  final name = _relative(path, repositoryRoot);
  final file = File(path);
  if (!file.existsSync()) {
    _problem(name, 'file not found');
    return;
  }

  final Object? json;
  try {
    json = jsonDecode(file.readAsStringSync());
  } on Object catch (error) {
    _problem(name, 'invalid JSON: $error');
    return;
  }
  if (json is! Map<String, dynamic>) {
    _problem(name, 'the root must be an object');
    return;
  }
  if (json['schemaVersion'] != _supportedSchemaVersion) {
    _problem(name, 'schemaVersion must be $_supportedSchemaVersion');
  }
  final updatedAt = json['updatedAt'];
  if (updatedAt != null &&
      (updatedAt is! String || DateTime.tryParse(updatedAt) == null)) {
    _problem(name, 'updatedAt must be null or an ISO 8601 date');
  }
  final artifacts = json['artifacts'];
  if (artifacts is! List) {
    _problem(name, 'artifacts must be a list');
    return;
  }

  final seen = <String>{};
  for (var index = 0; index < artifacts.length; index++) {
    final where = '$name, artifacts[$index]';
    final artifact = artifacts[index];
    if (artifact is! Map<String, dynamic>) {
      _problem(where, 'must be an object');
      continue;
    }
    for (final field in _artifactStringFields) {
      final value = artifact[field];
      if (value is! String || value.isEmpty) {
        _problem(where, '"$field" must be a non-empty text');
      }
    }
    for (final field in _artifactIntegerFields) {
      final value = artifact[field];
      if (value is! int || value <= 0) {
        _problem(where, '"$field" must be a positive integer');
      }
    }
    if (!_apps.contains(artifact['app'])) {
      _problem(where, '"app" must be one of $_apps');
    }
    if (!_platforms.contains(artifact['platform'])) {
      _problem(where, '"platform" must be one of $_platforms');
    }

    final url = artifact['url'];
    if (strictUrls && url is String && !url.startsWith(_trustedUrlPrefix)) {
      _problem(where, '"url" is not a release of this repository: $url');
    }
    final sha256 = artifact['sha256'];
    if (sha256 is String && !RegExp(r'^[0-9a-f]{64}$').hasMatch(sha256)) {
      _problem(where, '"sha256" must have 64 lowercase hexadecimal digits');
    }
    final publishedAt = artifact['publishedAt'];
    if (publishedAt is String && DateTime.tryParse(publishedAt) == null) {
      _problem(where, '"publishedAt" must be an ISO 8601 date');
    }

    // Uma entrada por combinação: é ela que o script de publicação substitui.
    final identity = [
      artifact['flavor'],
      artifact['app'],
      artifact['platform'],
      artifact['format'],
      artifact['architecture'] ?? '',
    ].join('/');
    if (!seen.add(identity)) {
      _problem(where, 'duplicated artifact: $identity');
    }
  }
}
