// screenshot.dart — fotografa a página no Chrome, sem janela, nos dois temas e
// em duas larguras, e avisa de qualquer erro que ela escreva no console. Só
// `dart:io` e `dart:convert`: sem pubspec e sem `pub get`.
//
// É a conferida visual de quem mexe na página: tema claro e escuro, tela de
// computador e de celular, e os três idiomas — sem abrir o navegador doze
// vezes. Fala com o Chrome pelo protocolo do DevTools.
//
// Rodar, da raiz do repositório, com o `dart tools/serve.dart` no ar:
//
//   dart tools/screenshot.dart
//   dart tools/screenshot.dart --languages pt,en,es
//   dart tools/screenshot.dart --url http://localhost:9000/ --out /tmp/shots
//   dart tools/screenshot.dart --page "download/?app=app&platform=macos"
//
// As imagens saem em build/screenshots/ (fora do git):
//
//   <página>-<idioma>-<tema>-<largura>.png            a página inteira
//   <página>-<idioma>-<tema>-<largura>-top.png        só a primeira tela
//   <página>-<idioma>-<tema>-<largura>-<seção>.png    a tela parada em cada
//                                                     seção com `id`
//
// Sai com 1 quando alguma página escreve erro no console — um script barrado
// pela política de segurança, um arquivo que não veio.

import 'dart:async';
import 'dart:convert';
import 'dart:io';

const _usage = '''
Usage: dart tools/screenshot.dart [options]

Takes full-page screenshots of the site in headless Chrome, in both themes and
in two widths, and reports what the page wrote to the console.

Options:
  --url <address>      where the site is served (default: http://localhost:8080/)
  --page <path>        the page to capture, relative to --url (default: the home)
  --languages <list>   comma-separated: pt, en, es (default: pt)
  --out <directory>    where the images go (default: build/screenshots)
  --chrome <path>      the Chrome executable (default: \$CHROME, or the usual
                       place of Google Chrome on this system)
  --reduced-motion     emulate "reduce motion"
  -h, --help           show this help
''';

const _usageExitCode = 64;

const _themes = ['light', 'dark'];

/// As larguras fotografadas: a de um notebook e a de um celular.
const _viewports = [
  (name: 'desktop', width: 1440, height: 900, mobile: false, scale: 1),
  (name: 'mobile', width: 390, height: 844, mobile: true, scale: 2),
];

/// O tempo que a página tem para assentar depois de carregar e de rolar.
const _settleTime = Duration(milliseconds: 900);

const _chromeCandidates = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  r'C:\Program Files\Google\Chrome\Application\chrome.exe',
];

Future<void> main(List<String> arguments) async {
  var baseUrl = 'http://localhost:8080/';
  var page = '';
  var languages = ['pt'];
  var reducedMotion = false;
  String? outputPath;
  String? chromePath = Platform.environment['CHROME'];

  for (var index = 0; index < arguments.length; index++) {
    final argument = arguments[index];
    String value() {
      if (index + 1 >= arguments.length) {
        stderr.writeln('error: $argument needs a value\n\n$_usage');
        exit(_usageExitCode);
      }
      return arguments[++index];
    }

    switch (argument) {
      case '-h' || '--help':
        stdout.write(_usage);
        return;
      case '--url':
        baseUrl = value();
      case '--page':
        page = value();
      case '--languages':
        languages = value().split(',').map((item) => item.trim()).toList();
      case '--out':
        outputPath = value();
      case '--chrome':
        chromePath = value();
      case '--reduced-motion':
        reducedMotion = true;
      default:
        stderr.writeln('error: unknown argument: $argument\n\n$_usage');
        exit(_usageExitCode);
    }
  }
  if (!baseUrl.endsWith('/')) baseUrl = '$baseUrl/';

  chromePath ??= _chromeCandidates
      .where((candidate) => File(candidate).existsSync())
      .firstOrNull;
  if (chromePath == null) {
    stderr.writeln(
      'error: Chrome not found — pass --chrome <path> or set CHROME',
    );
    exit(1);
  }

  final repositoryRoot = File.fromUri(Platform.script).parent.parent.path;
  final output = Directory(outputPath ?? '$repositoryRoot/build/screenshots')
    ..createSync(recursive: true);

  final profile = Directory.systemTemp.createTempSync('clockinit-screenshot-');
  final chrome = await Process.start(chromePath, [
    '--headless=new',
    '--remote-debugging-port=0',
    '--user-data-dir=${profile.path}',
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--disable-gpu',
    'about:blank',
  ]);

  var failed = false;
  try {
    final browser = await _Browser.connect(chrome);
    final pageName = page.isEmpty
        ? 'home'
        : page.split('?').first.replaceAll(RegExp('[^a-z0-9]+'), '-');

    for (final language in languages) {
      for (final theme in _themes) {
        for (final viewport in _viewports) {
          final separator = page.contains('?') ? '&' : '?';
          final url = '$baseUrl$page${separator}lang=$language&theme=$theme';
          final name = [
            pageName.replaceAll(RegExp(r'^-+|-+$'), ''),
            language,
            theme,
            viewport.name,
          ].join('-');

          final errors = await browser.capture(
            url: url,
            width: viewport.width,
            height: viewport.height,
            mobile: viewport.mobile,
            scale: viewport.scale,
            theme: theme,
            reducedMotion: reducedMotion,
            basePath: '${output.path}/$name',
          );
          stdout.writeln('$name.png');
          for (final error in errors) {
            failed = true;
            stderr.writeln('  console: $error');
          }
        }
      }
    }
    await browser.close();
  } on Object catch (error) {
    failed = true;
    stderr.writeln('error: $error');
  } finally {
    chrome.kill();
    await chrome.exitCode;
    try {
      profile.deleteSync(recursive: true);
    } on FileSystemException {
      // O Chrome ainda pode estar soltando a pasta; ela é do temporário.
    }
  }

  stdout.writeln('Images in ${output.path}');
  if (failed) exitCode = 1;
}

/// A conversa com o Chrome pelo protocolo do DevTools.
class _Browser {
  _Browser._(this._socket) {
    _socket.listen((data) {
      final message = jsonDecode(data as String) as Map<String, dynamic>;
      final id = message['id'];
      if (id is int) {
        _pending.remove(id)?.complete(message);
      } else if (!_events.isClosed) {
        // O Chrome ainda manda eventos enquanto a conexão fecha.
        _events.add(message);
      }
    });
  }

  final WebSocket _socket;
  final _pending = <int, Completer<Map<String, dynamic>>>{};
  final _events = StreamController<Map<String, dynamic>>.broadcast();
  var _nextId = 1;

  /// O Chrome imprime o endereço do DevTools no stderr quando sobe.
  static Future<_Browser> connect(Process chrome) async {
    final endpoint = Completer<String>();
    chrome.stderr
        .transform(utf8.decoder)
        .transform(const LineSplitter())
        .listen((line) {
          final match = RegExp(r'DevTools listening on (ws://\S+)')
              .firstMatch(line);
          if (match != null && !endpoint.isCompleted) {
            endpoint.complete(match.group(1));
          }
        });
    unawaited(chrome.stdout.drain<void>());

    final address = await endpoint.future.timeout(
      const Duration(seconds: 20),
      onTimeout: () => throw StateError('Chrome did not start in time'),
    );
    return _Browser._(await WebSocket.connect(address));
  }

  Future<Map<String, dynamic>> _send(
    String method, [
    Map<String, Object?> parameters = const {},
    String? sessionId,
  ]) async {
    final id = _nextId++;
    final completer = Completer<Map<String, dynamic>>();
    _pending[id] = completer;
    _socket.add(
      jsonEncode({
        'id': id,
        'method': method,
        'params': parameters,
        'sessionId': ?sessionId,
      }),
    );
    final response = await completer.future.timeout(
      const Duration(seconds: 30),
      onTimeout: () => throw StateError('$method did not answer in time'),
    );
    if (response['error'] != null) {
      throw StateError('$method failed: ${response['error']}');
    }
    return (response['result'] as Map<String, dynamic>?) ?? const {};
  }

  /// Abre a página, espera assentar, rola até o fim (para o que entra em cena
  /// com a rolagem entrar) e fotografa: a primeira tela, a página inteira e a
  /// tela parada em cada seção. Devolve os erros do console.
  Future<List<String>> capture({
    required String url,
    required int width,
    required int height,
    required bool mobile,
    required int scale,
    required String theme,
    required bool reducedMotion,
    required String basePath,
  }) async {
    final target = await _send('Target.createTarget', {'url': 'about:blank'});
    final targetId = target['targetId'] as String;
    final attached = await _send('Target.attachToTarget', {
      'targetId': targetId,
      'flatten': true,
    });
    final session = attached['sessionId'] as String;

    final errors = <String>[];
    final subscription = _events.stream
        .where((event) => event['sessionId'] == session)
        .listen((event) {
          final parameters =
              (event['params'] as Map<String, dynamic>?) ?? const {};
          switch (event['method']) {
            case 'Runtime.exceptionThrown':
              final details =
                  parameters['exceptionDetails'] as Map<String, dynamic>;
              final exception = details['exception'] as Map<String, dynamic>?;
              errors.add('${exception?['description'] ?? details['text']}');
            case 'Runtime.consoleAPICalled' when parameters['type'] == 'error':
              final values = parameters['args'] as List<dynamic>;
              errors.add(
                values
                    .map(
                      (value) =>
                          (value as Map<String, dynamic>)['description'] ??
                          value['value'],
                    )
                    .join(' '),
              );
            case 'Log.entryAdded':
              final entry = parameters['entry'] as Map<String, dynamic>;
              if (entry['level'] == 'error') {
                errors.add('${entry['text']} ${entry['url'] ?? ''}'.trim());
              }
          }
        });

    try {
      await _send('Page.enable', const {}, session);
      await _send('Runtime.enable', const {}, session);
      await _send('Log.enable', const {}, session);
      await _send('Emulation.setDeviceMetricsOverride', {
        'width': width,
        'height': height,
        'deviceScaleFactor': scale,
        'mobile': mobile,
      }, session);
      await _send('Emulation.setEmulatedMedia', {
        'features': [
          {'name': 'prefers-color-scheme', 'value': theme},
          {
            'name': 'prefers-reduced-motion',
            'value': reducedMotion ? 'reduce' : 'no-preference',
          },
        ],
      }, session);

      final loaded = _events.stream.firstWhere(
        (event) =>
            event['sessionId'] == session &&
            event['method'] == 'Page.loadEventFired',
      );
      await _send('Page.navigate', {'url': url}, session);
      await loaded.timeout(
        const Duration(seconds: 30),
        onTimeout: () => throw StateError('$url did not load in time'),
      );
      await Future<void>.delayed(_settleTime);

      final top = await _send('Page.captureScreenshot', {
        'format': 'png',
      }, session);
      File('$basePath-top.png')
          .writeAsBytesSync(base64Decode(top['data'] as String));

      // Rola a página tela a tela, e volta ao topo.
      await _send('Runtime.evaluate', {
        'awaitPromise': true,
        'expression':
            '''
          (async () => {
            const wait = (time) => new Promise((done) => setTimeout(done, time));
            document.documentElement.style.scrollBehavior = 'auto';
            const step = window.innerHeight * 0.6;
            for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
              window.scrollTo(0, y);
              await wait(140);
            }
            window.scrollTo(0, 0);
            await wait(${_settleTime.inMilliseconds});
          })()
        ''',
      }, session);

      final metrics = await _send('Page.getLayoutMetrics', const {}, session);
      final content = metrics['cssContentSize'] as Map<String, dynamic>;
      final full = await _send('Page.captureScreenshot', {
        'format': 'png',
        'captureBeyondViewport': true,
        'clip': {
          'x': 0,
          'y': 0,
          'width': content['width'],
          'height': content['height'],
          'scale': 1,
        },
      }, session);
      File('$basePath.png')
          .writeAsBytesSync(base64Decode(full['data'] as String));

      // A tela parada em cada seção: é onde o parallax e o cabeçalho fixo
      // aparecem como quem visita os vê.
      final listed = await _send('Runtime.evaluate', {
        'returnByValue': true,
        'expression':
            "[...document.querySelectorAll('main section[id]')]"
            ".map((section) => section.id).filter((id) => id !== 'top')",
      }, session);
      final sections =
          ((listed['result'] as Map<String, dynamic>)['value']
                      as List<dynamic>? ??
                  const [])
              .cast<String>();
      for (final section in sections) {
        await _send('Runtime.evaluate', {
          'awaitPromise': true,
          'expression':
              '''
          (async () => {
            document.getElementById(${jsonEncode(section)}).scrollIntoView();
            await new Promise(
              (done) => setTimeout(done, ${_settleTime.inMilliseconds}),
            );
          })()
        ''',
        }, session);
        final shot = await _send('Page.captureScreenshot', {
          'format': 'png',
        }, session);
        File('$basePath-$section.png')
            .writeAsBytesSync(base64Decode(shot['data'] as String));
      }
    } finally {
      await subscription.cancel();
      await _send('Target.closeTarget', {'targetId': targetId});
    }
    return errors;
  }

  Future<void> close() async {
    await _events.close();
    await _socket.close();
  }
}
