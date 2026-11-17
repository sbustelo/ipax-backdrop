<?php
// PATH: examples/performance-longpage.php
$htmlFile = __DIR__ . '/performance-longpage.html';
if (is_file($htmlFile) && filemtime($htmlFile) >= filemtime(__FILE__)) {
	readfile($htmlFile);
	exit;
}

$cols = 4;
$targetBoxes = 400;
$occupied = [];
$boxes = [];
$maxRow = 0;
$r = 0;

$patterns = [
	[4, 1],
	[3, 3],
	[3, 2],
	[2, 2],
	[2, 1],
	[1, 2],
	[1, 1]
];

while (count($boxes) < $targetBoxes || $r <= $maxRow) {
	for ($c = 0; $c < $cols; $c++) {
		if (!empty($occupied[$r][$c])) {
			continue;
		}

		$maxW = 0;
		while (($c + $maxW) < $cols && empty($occupied[$r][$c + $maxW])) {
			$maxW++;
		}

		$w = 1;
		$h = 1;
		$remaining = $targetBoxes - count($boxes);

		if ($remaining > 8) {
			$hash = (($r * 31) + ($c * 17)) % 19;
			$cand = null;
			if ($hash === 0 && $maxW === 4) {
				$cand = $patterns[0];
			} elseif ($hash === 3 && $maxW >= 3) {
				$cand = $patterns[1];
			} elseif ($hash === 6 && $maxW >= 3) {
				$cand = $patterns[2];
			} elseif (($hash === 8 || $hash === 14) && $maxW >= 2) {
				$cand = $patterns[3];
			} elseif (($hash === 10 || $hash === 16) && $maxW >= 2) {
				$cand = $patterns[4];
			} elseif ($hash === 12 || $hash === 17) {
				$cand = $patterns[5];
			}

			if ($cand !== null && $cand[0] <= $maxW) {
				$w = $cand[0];
				$h = $cand[1];
			}
		}

		for ($dr = 0; $dr < $h; $dr++) {
			for ($dc = 0; $dc < $w; $dc++) {
				$occupied[$r + $dr][$c + $dc] = true;
			}
		}
		if (($r + $h - 1) > $maxRow) {
			$maxRow = $r + $h - 1;
		}

		$boxes[] = [
			'w' => $w,
			'h' => $h
		];
	}
	$r++;
}

$totalBoxes = count($boxes);

ob_start();
?><!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
	<title>ipax-backdrop: Long Page 400 Boxes Benchmark</title>
	<link rel="stylesheet" href="css/performance-longpage.css">
</head>
<body>
	<header class="pt-hud">
		<div class="pt-hud-row">
			<div data-perf-nav="host"></div>
			<div class="pt-hud-stat">In viewport: <span data-pt-role="visible">0</span> / <span data-pt-role="total"><?php echo $totalBoxes; ?></span></div>
			<div class="pt-hud-stat">Engine: <span data-pt-role="backend">init</span></div>
			<div class="pt-hud-stat">Last 32 avg: <span data-pt-role="ms">0.0</span> ms</div>
			<div class="pt-hud-stat">rAF FPS: <span data-pt-role="raf-fps">0</span></div>

			<div class="pt-hud-controls">
				<label class="pt-toggle-wrap">
					<span>Show effect</span>
					<input type="checkbox" class="pt-switch" data-pt-control="effect" checked>
				</label>
				<label class="pt-hud-group">Contrast:
					<input type="range" class="pt-hud-range" min="1" max="15" step="0.5" value="4.5" data-pt-control="contrast">
					<input type="number" class="pt-hud-num" min="1" max="15" step="0.5" value="4.5" data-pt-num="contrast">
				</label>
				<label class="pt-hud-group">Blur:
					<input type="range" class="pt-hud-range" min="0" max="32" step="1" value="8" data-pt-control="blur">
					<input type="number" class="pt-hud-num" min="0" max="32" step="1" value="8" data-pt-num="blur">
				</label>
				<label class="pt-hud-group">Target FPS:
					<select class="pt-hud-select" data-pt-control="fps">
						<option value="60">60</option>
						<option value="120">120</option>
						<option value="0">Max (0)</option>
					</select>
				</label>
			</div>
		</div>

		<div class="pt-hud-row pt-hud-row-sub">
			<span class="pt-hud-label">Background animation:</span>
			<label class="pt-hud-group">
				<input type="checkbox" data-pt-control="bg-motion">
				<span>Background motion (150%)</span>
			</label>
			<label class="pt-hud-group">
				<input type="checkbox" data-pt-control="bg-swap">
				<span>Swap</span>
			</label>
			<label class="pt-hud-group">Speed:
				<select class="pt-hud-select" data-pt-control="bg-speed" disabled>
					<option value="slow">Slow</option>
					<option value="medium" selected>Medium</option>
					<option value="fast">Fast</option>
				</select>
			</label>
			<div class="pt-hud-controls">
				<button type="button" class="pt-hud-btn pt-hud-btn-accent" data-perf-action="open-bg-modal">🖼️ Backgrounds (16)</button>
			</div>
		</div>
	</header>

	<article class="pt-intro">
		<h1>Long Page Stress Test (400 Boxes)</h1>
		<p>Renders a dense grid of 400 boxes over 16 backgrounds, each running an <code>ipax-backdrop</code> instance. Designed to stress-test the engine against long-scroll, high-demand layouts (e.g., dense newspaper indexes, portals or catalogs with backdrop titles over thumbnails).</p>
		<h3>Performance mitigations</h3>
		<ul>
			<li><strong>Viewport Culling:</strong> <code>IntersectionObserver</code> suspends rendering for off-screen layers.</li>
			<li><strong>Bounded DOM Polling:</strong> Caps <code>elementsFromPoint()</code> queries to viewport area limits, preventing main thread locks on oversized containers.</li>
			<li><strong>CSSOM Isolation:</strong> Scoped CSS custom properties prevent global style recalculation when manipulating sliders.</li>
			<li><strong>Event Debouncing:</strong> Coalesces simultaneous async texture loads into single invalidation ticks.</li>
		</ul>
		<p><small><em>Note: The harmonic palettes used in the default generated textures preview the upcoming <strong>IPAX Color System Builder</strong>.</em></small></p>
	</article>

	<main class="pt-grid" data-pt-role="grid">
		<?php foreach ($boxes as $i => $box): 
			$hPx = $box['h'] * 170 + ($box['h'] - 1) * 16;
			$glassHPx = $hPx * 0.64;
			$maxFs = max(16, ($glassHPx - 32) / 1.2); 
			$randN = rand(0, 12);
			$fs = min(16 * pow(1.1487, $randN), $maxFs);
			$color = rand(0, 1) ? '#000000' : '#ffffff';
		?>
		<div class="pt-cell pt-w-<?php echo $box['w']; ?> pt-h-<?php echo $box['h']; ?> pt-bg-<?php echo ($i % 16); ?>" data-pt-cell="<?php echo $i; ?>">
			<div class="pt-glass" data-ipax-backdrop style="--pt-color: <?php echo $color; ?>; --pt-fs: <?php echo round($fs, 1); ?>px;">
				<div class="pt-content">Box <?php echo $i; ?> <small>(<?php echo $box['w']; ?>&times;<?php echo $box['h']; ?>)</small></div>
			</div>
		</div>
		<?php endforeach; ?>
	</main>

	<dialog class="perf-modal" data-perf-modal="bg">
		<div class="perf-modal-card">
			<header class="perf-modal-head">
				<h2 class="perf-modal-title">Background Image Pool</h2>
				<button type="button" class="perf-modal-close" data-perf-action="pool-close" aria-label="Close">&times;</button>
			</header>
			<div class="perf-modal-toolbar">
				<button type="button" class="perf-modal-btn" data-perf-action="pool-random">🎲 Generate Random</button>
				<label class="perf-modal-btn perf-modal-btn-primary perf-modal-upload">
					<span>📁 Load Local Images&hellip;</span>
					<input type="file" accept="image/*" multiple data-perf-control="pool-files">
				</label>
				<span class="perf-modal-meta" data-perf-role="pool-summary">0 images</span>
			</div>
			<div class="perf-modal-drop" data-perf-role="pool-drop">
				Drop image files here or use <strong>📁 Load Local Images</strong> to test real photography.
			</div>
			<div class="perf-modal-grid" data-perf-role="pool-grid"></div>
		</div>
	</dialog>

	<script src="../dist/ipax-backdrop.min.js"></script>
	<script src="js/example-images.js"></script>
	<script src="js/performance-common.js"></script>
	<script src="js/performance-longpage.js"></script>
</body>
</html>
<?php
$content = ob_get_clean();
file_put_contents($htmlFile, $content);
echo $content;