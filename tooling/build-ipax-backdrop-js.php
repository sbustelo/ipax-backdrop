<?php
/**
 * PATH: ./tooling/build-ipax-backdrop-js.php
 * IPAX-BACKDROP BUNDLER - PHASE 2: TWO-PASS COMPILATION & HARDENED MINIFICATION
 */

declare(strict_types=1);

if (php_sapi_name() !== 'cli' && !headers_sent()) {
    header('Content-Type: text/plain; charset=utf-8');
}

$rootDir = dirname(__DIR__);

// 1. Load configuration with defaults fallback
$defaultConfig = [
    'output_file' => 'dist/ipax-backdrop.js',
    'echo'        => true,
    'sources'     => ['lib', 'src'],
    'minify'      => [
        'enabled' => false,
        'api_url' => 'https://www.toptal.com/developers/javascript-minifier/api/raw',
        'timeout' => 10
    ]
];

$customConfigFile = __DIR__ . '/_build-config.php';
$config = $defaultConfig;

if (file_exists($customConfigFile)) {
    $loadedConfig = require $customConfigFile;
    if (is_array($loadedConfig)) {
        $config = array_replace_recursive($defaultConfig, $loadedConfig);
    }
}

// 2. Normalize output verbosity flag (CLI and Web)
if (php_sapi_name() === 'cli') {
    global $argv;
    if (isset($argv) && is_array($argv)) {
        foreach ($argv as $arg) {
            if (in_array($arg, ['--quiet', '--silent', '--echo=false', '--echo=0'], true)) {
                $config['echo'] = false;
            } elseif (in_array($arg, ['--verbose', '--echo=true', '--echo=1'], true)) {
                $config['echo'] = true;
            }
        }
    }
} else {
    if (isset($_GET['echo'])) {
        $getEcho = strtolower(trim((string)$_GET['echo']));
        if (in_array($getEcho, ['false', '0', 'no', 'off'], true)) {
            $config['echo'] = false;
        } elseif (in_array($getEcho, ['true', '1', 'yes', 'on'], true)) {
            $config['echo'] = true;
        }
    }
}

// 3. Scan JavaScript files recursively with natural sorting and prefix exclusions (_ and .)
function ipax_scan_js_files(string $baseDir): array {
    if (!is_dir($baseDir)) {
        return [];
    }

    $matchedFiles = [];
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($baseDir, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );

    foreach ($iterator as $item) {
        if (!$item->isFile() || strtolower($item->getExtension()) !== 'js') {
            continue;
        }

        $filename = $item->getFilename();
        if ($filename[0] === '_' || $filename[0] === '.') {
            continue;
        }

        $relativePath = str_replace('\\', '/', substr($item->getPathname(), strlen($baseDir) + 1));
        $segments = explode('/', $relativePath);
        $isIgnored = false;

        foreach ($segments as $segment) {
            if ($segment !== '' && ($segment[0] === '_' || $segment[0] === '.')) {
                $isIgnored = true;
                break;
            }
        }

        if ($isIgnored) {
            continue;
        }

        $matchedFiles[] = str_replace('\\', '/', $item->getPathname());
    }

    sort($matchedFiles, SORT_NATURAL);
    return $matchedFiles;
}

// 4. Atomic collision backup rotator
function ipax_rotate_backup(string $targetAbsPath): bool {
    if (!file_exists($targetAbsPath)) {
        return true;
    }

    $fileInfo = pathinfo($targetAbsPath);
    $filename = $fileInfo['filename'];
    $extension = isset($fileInfo['extension']) && $fileInfo['extension'] !== '' ? '.' . $fileInfo['extension'] : '';
    $isoDate = date('Y-m-d H-i-s');
    $backupFilename = "_{$filename}-bak {$isoDate}{$extension}";
    $backupAbsPath = $fileInfo['dirname'] . '/' . $backupFilename;

    return rename($targetAbsPath, $backupAbsPath);
}







// 5. Minified path resolver ($name.ext -> $name.min.ext)
function ipax_resolve_minified_path(string $path): string {
    $fileInfo = pathinfo($path);
    $dirname = (isset($fileInfo['dirname']) && $fileInfo['dirname'] !== '.') ? $fileInfo['dirname'] . '/' : '';
    $extension = isset($fileInfo['extension']) && $fileInfo['extension'] !== '' ? '.' . $fileInfo['extension'] : '';
    return $dirname . $fileInfo['filename'] . '.min' . $extension;
}

// 6. Remote minification engine with fallback transport (PHP 8.5+ compliant)
function ipax_minify_js(string $code, array $options): ?string {
    $apiUrl = $options['api_url'] ?? 'https://www.toptal.com/developers/javascript-minifier/api/raw';
    $timeout = isset($options['timeout']) ? (int)$options['timeout'] : 10;

    if (function_exists('curl_init')) {
        $ch = curl_init($apiUrl);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => http_build_query(['input' => $code]),
            CURLOPT_TIMEOUT        => $timeout,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_SSL_VERIFYPEER => true
        ]);
        $response = curl_exec($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);

        // curl_close() is deprecated in PHP 8.5+; CurlHandle lifecycle is GC-managed
        if (PHP_VERSION_ID < 80000 && is_resource($ch)) {
            curl_close($ch);
        }

        if ($response !== false && $httpCode === 200 && trim((string)$response) !== '') {
            return (string)$response;
        }
        return null;
    }

    $context = stream_context_create([
        'http' => [
            'method'  => 'POST',
            'header'  => "Content-Type: application/x-www-form-urlencoded\r\n",
            'content' => http_build_query(['input' => $code]),
            'timeout' => $timeout
        ]
    ]);

    $response = @file_get_contents($apiUrl, false, $context);
    if ($response !== false && trim((string)$response) !== '') {
        return (string)$response;
    }

    return null;
}

// 7. Source discovery
$filesToBundle = [];





foreach ($config['sources'] as $sourceDirName) {
    $absSourceDir = $rootDir . '/' . trim($sourceDirName, '/\\');
    $filesInSource = ipax_scan_js_files($absSourceDir);
    $filesToBundle = array_merge($filesToBundle, $filesInSource);
}

if (empty($filesToBundle)) {
    if ($config['echo']) {
        echo "Error: No valid JS files found to bundle.\n";
    }
    exit(1);
}

// 8. RAM concatenation with defensive syntax isolation
$buffer = "/**\n * IPAX BACKDROP BUNDLE\n * Compiled: " . date('Y-m-d H:i:s') . "\n */\n\n";

foreach ($filesToBundle as $filePath) {
    $relPath = str_replace('\\', '/', substr($filePath, strlen($rootDir) + 1));
    $content = file_get_contents($filePath);
    $buffer .= "/* --- {$relPath} --- */\n";
    $buffer .= rtrim((string)$content) . "\n;\n\n";
}

// 9. Destination directory validation
$targetRelPath = ltrim(str_replace('\\', '/', $config['output_file']), '/');
$targetAbsPath = $rootDir . '/' . $targetRelPath;
$targetDir = dirname($targetAbsPath);

if (!is_dir($targetDir)) {
    if (!mkdir($targetDir, 0777, true) && !is_dir($targetDir)) {
        if ($config['echo']) {
            echo "Critical error: Could not create output directory: {$targetDir}\n";
        }
        exit(1);
    }
}

// ============================================================================
// PASS 1: UNMINIFIED BUNDLE COMPILATION
// ============================================================================
if (!ipax_rotate_backup($targetAbsPath)) {
    if ($config['echo']) {
        echo "Critical error: Could not rotate backup for: {$targetAbsPath}\n";
    }
    exit(1);
}

$writeResult = file_put_contents($targetAbsPath, $buffer, LOCK_EX);
if ($writeResult === false) {
    if ($config['echo']) {
        echo "Critical error: Failed writing output to: {$targetAbsPath}\n";
    }
    exit(1);
}

if ($config['echo']) {
    echo "{$targetRelPath} created\n";
}

// ============================================================================
// PASS 2: MINIFIED BUNDLE COMPILATION (CONDITIONAL)
// ============================================================================
if (!empty($config['minify']['enabled'])) {
    $minRelPath = ipax_resolve_minified_path($targetRelPath);
    $minAbsPath = $rootDir . '/' . $minRelPath;

    $minifiedContent = ipax_minify_js($buffer, (array)$config['minify']);

    if ($minifiedContent === null) {
        if ($config['echo']) {
            echo "Warning: Minification API request failed or timed out. '{$minRelPath}' was not generated.\n";
        }
    } else {
        if (!ipax_rotate_backup($minAbsPath)) {
            if ($config['echo']) {
                echo "Critical error: Could not rotate backup for: {$minAbsPath}\n";
            }
            exit(1);
        }

        $minWriteResult = file_put_contents($minAbsPath, $minifiedContent, LOCK_EX);
        if ($minWriteResult === false) {
            if ($config['echo']) {
                echo "Critical error: Failed writing minified output to: {$minAbsPath}\n";
            }
            exit(1);
        }

        if ($config['echo']) {
            echo "{$minRelPath} created\n";
        }
    }
}