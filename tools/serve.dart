// serve.dart — serve a pasta docs/ em http://localhost:8080, para ver a página
// antes de publicar. Só `dart:io`: sem pubspec e sem `pub get`.
//
// A página não abre direto do arquivo (file://): os scripts são módulos e o
// latest.json é lido por `fetch`, e o navegador barra os dois fora do http.
//
// Rodar, da raiz do repositório:
//
//   dart tools/serve.dart
//   dart tools/serve.dart --port 9000
//   dart tools/serve.dart --manifest tools/fixtures/latest.sample.json
//
// Com --manifest, o arquivo indicado é servido no lugar do docs/latest.json —
// é como se vê a página com versões publicadas sem mexer no manifesto real.
//
// Como o GitHub Pages: o endereço de uma pasta entrega o index.html dela, e o
// que não existe entrega o docs/404.html com status 404.

import 'dart:io';

const _usage = '''
Usage: dart tools/serve.dart [--port <number>] [--manifest <file>]

Serves docs/ on http://localhost:<port> (default 8080).

Options:
  --port <number>     the port to listen on (default: 8080)
  --manifest <file>   serve this file as latest.json instead of docs/latest.json
  -h, --help          show this help
''';

/// O código de saída de um comando mal formado.
const _usageExitCode = 64;

const _defaultPort = 8080;

const _contentTypes = {
  'html': 'text/html; charset=utf-8',
  'css': 'text/css; charset=utf-8',
  'js': 'text/javascript; charset=utf-8',
  'json': 'application/json; charset=utf-8',
  'svg': 'image/svg+xml',
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'webp': 'image/webp',
  'ico': 'image/x-icon',
  'txt': 'text/plain; charset=utf-8',
  'xml': 'application/xml; charset=utf-8',
  'woff2': 'font/woff2',
};

Future<void> main(List<String> arguments) async {
  var port = _defaultPort;
  String? manifestPath;

  for (var index = 0; index < arguments.length; index++) {
    final argument = arguments[index];
    switch (argument) {
      case '-h' || '--help':
        stdout.write(_usage);
        return;
      case '--port' || '--manifest':
        if (index + 1 >= arguments.length) {
          stderr.writeln('error: $argument needs a value\n\n$_usage');
          exit(_usageExitCode);
        }
        final value = arguments[++index];
        if (argument == '--manifest') {
          manifestPath = value;
        } else {
          final parsed = int.tryParse(value);
          if (parsed == null || parsed < 1 || parsed > 65535) {
            stderr.writeln('error: invalid port: $value\n\n$_usage');
            exit(_usageExitCode);
          }
          port = parsed;
        }
      default:
        stderr.writeln('error: unknown argument: $argument\n\n$_usage');
        exit(_usageExitCode);
    }
  }

  // tools/serve.dart -> a raiz do repositório é a pasta de cima de tools/.
  final repositoryRoot = File.fromUri(Platform.script).parent.parent;
  final siteRoot = Directory('${repositoryRoot.path}/docs');
  if (!siteRoot.existsSync()) {
    stderr.writeln('error: ${siteRoot.path} not found');
    exit(1);
  }
  final siteRootPath = siteRoot.resolveSymbolicLinksSync();

  File? manifestOverride;
  if (manifestPath != null) {
    manifestOverride = File(manifestPath);
    if (!manifestOverride.existsSync()) {
      stderr.writeln('error: manifest not found: $manifestPath');
      exit(1);
    }
  }

  final HttpServer server;
  try {
    server = await HttpServer.bind(InternetAddress.loopbackIPv4, port);
  } on SocketException catch (error) {
    stderr.writeln('error: could not listen on port $port: ${error.message}');
    exit(1);
  }

  stdout.writeln('Serving ${siteRoot.path}');
  if (manifestOverride != null) {
    stdout.writeln('latest.json comes from ${manifestOverride.path}');
  }
  stdout.writeln('http://localhost:$port  (Ctrl+C to stop)');

  await for (final request in server) {
    await _handle(request, siteRootPath, manifestOverride);
  }
}

Future<void> _handle(
  HttpRequest request,
  String siteRootPath,
  File? manifestOverride,
) async {
  final response = request.response;
  // Sem cache: o que se edita aparece no próximo recarregar.
  response.headers.set(HttpHeaders.cacheControlHeader, 'no-store');

  try {
    if (request.method != 'GET' && request.method != 'HEAD') {
      response.statusCode = HttpStatus.methodNotAllowed;
      return;
    }

    var file = _resolve(request.uri, siteRootPath);
    if (file != null &&
        manifestOverride != null &&
        file.path == '$siteRootPath/latest.json') {
      file = manifestOverride;
    }

    if (file == null || !file.existsSync()) {
      response.statusCode = HttpStatus.notFound;
      file = File('$siteRootPath/404.html');
      if (!file.existsSync()) {
        response.write('Not found');
        return;
      }
    }

    final extension = file.path.split('.').last.toLowerCase();
    response.headers.set(
      HttpHeaders.contentTypeHeader,
      _contentTypes[extension] ?? 'application/octet-stream',
    );
    response.headers.set(HttpHeaders.contentLengthHeader, file.lengthSync());
    if (request.method == 'GET') await response.addStream(file.openRead());
  } on Object catch (error) {
    stderr.writeln('error: ${request.uri.path}: $error');
    response.statusCode = HttpStatus.internalServerError;
  } finally {
    stdout.writeln(
      '${response.statusCode} ${request.method} ${request.uri.path}',
    );
    await response.close();
  }
}

/// O arquivo que o endereço pede, ou `null` quando ele sai de docs/.
File? _resolve(Uri uri, String siteRootPath) {
  final segments = uri.pathSegments.where((segment) => segment.isNotEmpty);
  if (segments.any((segment) => segment == '..' || segment.contains('\\'))) {
    return null;
  }

  var path = [siteRootPath, ...segments].join('/');
  if (FileSystemEntity.isDirectorySync(path)) path = '$path/index.html';

  final file = File(path);
  if (!file.existsSync()) return file;
  // Um link simbólico dentro de docs/ não leva para fora dela.
  final resolved = file.resolveSymbolicLinksSync();
  return resolved.startsWith('$siteRootPath/') ? File(resolved) : null;
}
