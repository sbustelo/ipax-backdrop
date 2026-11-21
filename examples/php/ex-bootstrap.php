<?php
// PATH: examples/php/ex-bootstrap.php
declare(strict_types=1);

$j0ApiFile = null;
$cursor = __DIR__;
for ($level = 0; $level <= 6; $level++) {
    foreach (['j0/api.php', 'ai0/j0/api.php'] as $relApi) {
        $cand = $cursor . '/' . $relApi;
        if (is_file($cand)) {
            $j0ApiFile = $cand;
            break 2;
        }
    }
    $parent = dirname($cursor);
    if ($parent === $cursor) {
        break;
    }
    $cursor = $parent;
}

if ($j0ApiFile === null) {
    http_response_code(500);
    echo 'Critical error: j0/api.php not found.';
    exit;
}

require_once $j0ApiFile;
j0_api()->use('tooling');

function ex_is_debug(): bool
{
    if (defined('EX_DEBUG') && EX_DEBUG) {
        return true;
    }
    if (!isset($_GET['debug'])) {
        return false;
    }
    $val = strtolower(trim((string) $_GET['debug']));
    return in_array($val, ['1', 'true', 'yes', 'on'], true);
}

/**
 * @param array<int, string> $sources
 */
function ex_css_tags(array $sources, string $bundleName): string
{
    $examplesDir = dirname(__DIR__);
    $absSources = [];
    foreach ($sources as $rel) {
        $absSources[] = $examplesDir . '/' . ltrim($rel, '/');
    }
    $outBase = $examplesDir . '/css/' . $bundleName;
    return j0_asset_tags($absSources, $outBase, 'css', 'css', ex_is_debug(), ['backup' => false]);
}

/**
 * @param array<int, string> $sources
 */
function ex_js_tags(array $sources, string $bundleName): string
{
    $examplesDir = dirname(__DIR__);
    $jsRoot = $examplesDir . '/js';
    $debug = ex_is_debug();
    $allSources = [];
    $localSources = [];
    $externalSources = [];

    foreach ($sources as $src) {
        if ($src === null || $src === '') {
            continue;
        }
        $isAbs = ($src[0] === '/') || (strlen($src) > 2 && $src[1] === ':');
        $absPath = $isAbs ? rtrim($src, '/') : ($examplesDir . '/' . ltrim($src, '/'));
        $allSources[] = $absPath;
        if (str_starts_with($absPath, $jsRoot . '/')) {
            $localSources[] = $absPath;
        } else {
            $externalSources[] = $absPath;
        }
    }

    $outBase = $jsRoot . '/' . $bundleName;
    if (!$debug || $externalSources === []) {
        return j0_asset_tags($allSources, $outBase, 'js', 'js', $debug, ['backup' => false]);
    }

    $vendorBase = $jsRoot . '/j0-deps-' . $bundleName;
    $vendorTag = j0_asset_tags($externalSources, $vendorBase, 'js', 'js', false, ['backup' => false]);
    $localTags = j0_asset_tags($localSources, $outBase, 'js', 'js', true, ['backup' => false]);
    return trim($vendorTag . "\n" . $localTags);
}

function ex_dist_script_tag(): string
{
    $repoRoot = dirname(__DIR__, 2);
    $rel = ex_is_debug() ? 'dist/ipax-backdrop.js' : 'dist/ipax-backdrop.min.js';
    $absFile = $repoRoot . '/' . $rel;
    if (is_file($absFile) && function_exists('j0_asset_deps')) {
        j0_asset_deps([$absFile]);
    }
    $ver = is_file($absFile) ? (int) filemtime($absFile) : 0;
    $url = htmlspecialchars('../' . $rel . ($ver > 0 ? '?v=' . $ver : ''), ENT_QUOTES, 'UTF-8');
    return '<script src="' . $url . '"></script>';
}

/**
 * @param array<int, string> $extraDeps
 */
function ex_render_page(string $phpFile, callable $renderCallback, array $extraDeps = []): void
{
    if (ex_is_debug()) {
        $renderCallback();
        return;
    }
    j0_static_html($phpFile, $renderCallback, $extraDeps);
}