<?php
// PATH: examples/editor.php
require_once __DIR__ . '/php/ex-bootstrap.php';

$cssTags = ex_css_tags([
	'css/editor-layout.css',
	'css/editor-controls.css',
	'css/editor-combo.css',
	'css/editor-stage.css'
], 'editor');
$distTag = ex_dist_script_tag();
$jsTags = ex_js_tags([j0_api()->assetDir('vfs'), 'js/common', 'js/editor'], 'editor');

ex_render_page(__FILE__, static function () use ($cssTags, $distTag, $jsTags): void {
?><!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>Lucid Glass Editor — ipax-backdrop</title>
	<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20,400,0,0">
	<?php echo $cssTags; ?>
</head>
<body>
	<div class="ed-app" data-ed-app>
		<main class="ed-workspace" data-ed-role="workspace">
			<div class="ed-stage" data-ed-role="stage">
				<div class="ed-stage-bg" data-ed-role="stage-bg"></div>
			</div>
		</main>

		<aside class="ed-inspector" data-ed-role="inspector">
			<header class="ed-inspector-top">
				<h1 class="ed-app-title">Lucid Glass editor</h1>
				<div class="ed-top-actions">
					<button type="button" class="ed-btn ed-btn-primary" data-ed-action="new-box" data-ed-tip="Create new text box">+ New box</button>
					<button type="button" class="ed-btn-icon" data-ed-action="delete-box" data-ed-tip="Delete selected box" disabled>
						<span class="ed-ico material-symbols-outlined" aria-hidden="true">delete</span>
					</button>
					<button type="button" class="ed-btn-icon is-active" data-ed-action="toggle-effect" data-ed-tip="Toggle Lucid Glass effect" aria-pressed="true">
						<span class="ed-ico material-symbols-outlined" aria-hidden="true">visibility</span>
					</button>
				</div>
			</header>

			<section class="ed-panel" data-ed-panel="project">
				<header class="ed-panel-header">
					<span>Project / Export</span>
					<button type="button" class="ed-panel-toggle" data-ed-action="toggle-panel" aria-expanded="true" aria-label="Collapse Project / Export">&#9662;</button>
				</header>
				<div class="ed-panel-body" data-ed-role="panel-body">
					<div class="ed-grid-3">
						<button type="button" class="ed-btn" data-ed-action="load-json">Load</button>
						<button type="button" class="ed-btn" data-ed-action="save-json">Save</button>
						<button type="button" class="ed-btn" data-ed-action="reset-project">Reset</button>
					</div>
					<button type="button" class="ed-btn ed-btn-full" data-ed-action="save-png">Export stage (PNG)</button>
					<p class="ed-hint-warn" data-ed-role="png-warning" hidden>&#9888;&#65039; Clean stage export requires Chrome.</p>
					<a href="https://ipax.bustelo.com.ar/?m=lucid-glass" target="_blank" rel="noopener" class="ed-btn ed-btn-link">About Lucid Glass &amp; IPAX-backdrop &#8599;</a>
					<input type="file" accept=".zip,.json,application/zip,application/json" data-ed-control="project-file" hidden>
				</div>
			</section>

			<section class="ed-panel" data-ed-panel="background">
				<header class="ed-panel-header">
					<span>Background</span>
					<span class="ed-panel-target" data-ed-role="bg-target-label" hidden>Stage</span>
					<button type="button" class="ed-panel-toggle" data-ed-action="toggle-panel" aria-expanded="true" aria-label="Collapse Background">&#9662;</button>
				</header>
				<div class="ed-panel-body" data-ed-role="panel-body">
					<label class="ed-prop">
						<span class="ed-label">Type</span>
						<select class="ed-select" data-ed-control="bg-type">
							<option value="none">None</option>
							<option value="image">Image</option>
							<option value="color">Solid Color</option>
							<option value="gradient">Gradient</option>
						</select>
					</label>

					<div class="ed-sub-group" data-ed-subpanel="bg-image" hidden>
						<div class="ed-img-preview" data-ed-action="pick-bg-image" role="button" tabindex="0">
							<span class="ed-img-text">Drag image or click to change</span>
							<input type="file" accept="image/*" data-ed-control="bg-file" hidden>
						</div>
						<label class="ed-prop">
							<span class="ed-label">Fit</span>
							<select class="ed-select" data-ed-control="bg-img-fit">
								<option value="cover">Cover</option>
								<option value="contain">Contain</option>
								<option value="100% 100%">Stretch</option>
								<option value="auto">Auto</option>
							</select>
						</label>
						<label class="ed-prop" data-ed-role="bg-img-opacity-row" hidden>
							<span class="ed-ico material-symbols-outlined ed-scrub" data-ed-scrub="bg-img-opacity" data-ed-tip="Image opacity (%)">opacity</span>
							<input type="range" min="0" max="100" step="1" value="100" data-ed-control="bg-img-opacity">
							<input type="number" min="0" max="100" step="1" value="100" data-ed-num="bg-img-opacity">
						</label>
						<button type="button" class="ed-btn ed-btn-full" data-ed-action="delete-bg" disabled>Delete background</button>
					</div>

					<div class="ed-sub-group" data-ed-subpanel="bg-color" hidden>
						<label class="ed-prop">
							<span class="ed-label">Color</span>
							<input type="color" value="#000000" class="ed-input-color" data-ed-control="bg-color-val">
						</label>
						<label class="ed-prop">
							<span class="ed-ico material-symbols-outlined ed-scrub" data-ed-scrub="bg-color-alpha" data-ed-tip="Color opacity (%)">opacity</span>
							<input type="range" min="0" max="100" step="1" value="40" data-ed-control="bg-color-alpha">
							<input type="number" min="0" max="100" step="1" value="40" data-ed-num="bg-color-alpha">
						</label>
					</div>

					<div class="ed-sub-group" data-ed-subpanel="bg-gradient" hidden>
						<div class="ed-prop">
							<span class="ed-label">Start</span>
							<input type="color" value="#000000" class="ed-swatch-sm" data-ed-control="bg-grad-c1">
							<input type="range" min="0" max="100" step="1" value="60" data-ed-control="bg-grad-a1">
							<input type="number" min="0" max="100" step="1" value="60" data-ed-num="bg-grad-a1">
						</div>
						<div class="ed-prop">
							<span class="ed-label">End</span>
							<input type="color" value="#1a4fd6" class="ed-swatch-sm" data-ed-control="bg-grad-c2">
							<input type="range" min="0" max="100" step="1" value="30" data-ed-control="bg-grad-a2">
							<input type="number" min="0" max="100" step="1" value="30" data-ed-num="bg-grad-a2">
						</div>
						<label class="ed-prop">
							<span class="ed-ico material-symbols-outlined ed-scrub" data-ed-scrub="bg-grad-angle" data-ed-tip="Gradient angle (deg)">rotate_right</span>
							<input type="range" min="0" max="360" step="1" value="135" data-ed-control="bg-grad-angle">
							<input type="number" min="0" max="360" step="1" value="135" data-ed-num="bg-grad-angle">
						</label>
					</div>
				</div>
			</section>

			<section class="ed-panel" data-ed-panel="performance">
				<header class="ed-panel-header">
					<span>Performance</span>
					<button type="button" class="ed-panel-toggle" data-ed-action="toggle-panel" aria-expanded="true" aria-label="Collapse Performance">&#9662;</button>
				</header>
				<div class="ed-panel-body" data-ed-role="panel-body">
					<label class="ed-prop">
						<span class="ed-label">Profile</span>
						<select class="ed-select" data-ed-control="perf-preset">
							<option value="high">High Quality</option>
							<option value="balanced">Balanced</option>
							<option value="fast">Fast</option>
							<option value="cpu">CPU Fallback</option>
							<option value="custom">Custom</option>
						</select>
					</label>
					<div class="ed-sub-group" data-ed-subpanel="perf-custom" hidden>
						<label class="ed-prop">
							<span class="ed-label">Backend</span>
							<select class="ed-select" data-ed-control="perf-backend">
								<option value="auto">Auto (WebGL)</option>
								<option value="webgl">WebGL 1</option>
								<option value="cpu">CPU</option>
							</select>
						</label>
						<label class="ed-prop"><span class="ed-ico material-symbols-outlined ed-scrub" data-ed-scrub="perf-cellsize" data-ed-tip="Probe cell size (px)">grid_on</span><input type="range" min="1" max="48" step="1" value="12" data-ed-control="perf-cellsize"><input type="number" min="1" max="48" step="1" value="12" data-ed-num="perf-cellsize"></label>
						<label class="ed-prop"><span class="ed-ico material-symbols-outlined ed-scrub" data-ed-scrub="perf-fps" data-ed-tip="Target FPS (0 = unlimited)">speed</span><input type="range" min="0" max="120" step="5" value="0" data-ed-control="perf-fps"><input type="number" min="0" max="120" step="5" value="0" data-ed-num="perf-fps"></label>
						<label class="ed-prop"><span class="ed-ico material-symbols-outlined ed-scrub" data-ed-scrub="perf-budget" data-ed-tip="Minimum pixel budget">memory</span><input type="range" min="1" max="500000" step="1000" value="65536" data-ed-control="perf-budget"><input type="number" min="1" max="500000" step="1000" value="65536" data-ed-num="perf-budget"></label>
						<label class="ed-prop"><span class="ed-ico material-symbols-outlined ed-scrub" data-ed-scrub="perf-scale" data-ed-tip="Max pixel scale">aspect_ratio</span><input type="range" min="0.5" max="3" step="0.25" value="2" data-ed-control="perf-scale"><input type="number" min="0.5" max="3" step="0.25" value="2" data-ed-num="perf-scale"></label>
					</div>
				</div>
			</section>

			<div data-ed-role="box-panels" hidden>
				<section class="ed-panel" data-ed-panel="position">
					<header class="ed-panel-header">
						<span>Position</span>
						<button type="button" class="ed-panel-toggle" data-ed-action="toggle-panel" aria-expanded="true" aria-label="Collapse Position">&#9662;</button>
					</header>
					<div class="ed-panel-body" data-ed-role="panel-body">
						<div class="ed-grid-4">
							<label class="ed-prop-compact">
								<span class="ed-axis-lbl ed-scrub" data-ed-scrub="box-x" data-ed-tip="X position (px)">X</span>
								<input type="number" step="1" value="80" class="ed-input-num" data-ed-num="box-x">
							</label>
							<label class="ed-prop-compact">
								<span class="ed-axis-lbl ed-scrub" data-ed-scrub="box-y" data-ed-tip="Y position (px)">Y</span>
								<input type="number" step="1" value="80" class="ed-input-num" data-ed-num="box-y">
							</label>
							<label class="ed-prop-compact">
								<span class="ed-axis-lbl ed-scrub" data-ed-scrub="box-w" data-ed-tip="Width (px)">W</span>
								<input type="number" min="80" step="1" value="360" class="ed-input-num" data-ed-num="box-w">
							</label>
							<label class="ed-prop-compact">
								<span class="ed-axis-lbl ed-scrub" data-ed-scrub="box-h" data-ed-tip="Height (px)">H</span>
								<input type="number" min="36" step="1" value="140" class="ed-input-num" data-ed-num="box-h">
							</label>
						</div>
					</div>
				</section>

				<section class="ed-panel" data-ed-panel="character">
					<header class="ed-panel-header">
						<span>Character</span>
						<button type="button" class="ed-panel-toggle" data-ed-action="toggle-panel" aria-expanded="true" aria-label="Collapse Character">&#9662;</button>
					</header>
					<div class="ed-panel-body" data-ed-role="panel-body">
						<div class="ed-prop">
							<span class="ed-label ed-label-xs">Font</span>
							<div class="ed-combo" data-ed-role="font-combo">
								<input type="text" class="ed-combo-input" placeholder="System or Google font..." autocomplete="off" spellcheck="false" data-ed-control="char-font">
								<button type="button" class="ed-combo-toggle" data-ed-action="toggle-font-menu" aria-label="Font presets">&#9662;</button>
								<ul class="ed-combo-menu" data-ed-role="font-menu" hidden></ul>
							</div>
							<span class="ed-ico material-symbols-outlined ed-font-status-ico" data-ed-role="font-status-icon" data-ed-tip="System font stack">computer</span>
						</div>

						<div class="ed-grid-3">
							<label class="ed-prop-compact">
								<span class="ed-ico material-symbols-outlined ed-scrub" data-ed-scrub="char-size" data-ed-tip="Font size (px)">format_size</span>
								<input type="number" min="8" max="400" step="1" value="32" class="ed-input-num" data-ed-control="char-size">
							</label>
							<label class="ed-prop-compact">
								<span class="ed-ico material-symbols-outlined ed-scrub" data-ed-scrub="char-leading" data-ed-tip="Line height">format_line_spacing</span>
								<input type="number" min="0.5" max="3" step="0.05" value="1.25" class="ed-input-num" data-ed-control="char-leading">
							</label>
							<label class="ed-prop-compact" data-ed-tip="Text color">
								<input type="color" value="#ffffff" class="ed-input-color" data-ed-control="char-color">
							</label>
						</div>

						<div class="ed-toolbar-row">
							<div class="ed-button-group">
								<button type="button" class="ed-btn-icon" data-ed-format="bold" data-ed-tip="Bold"><b>B</b></button>
								<button type="button" class="ed-btn-icon" data-ed-format="italic" data-ed-tip="Italic"><i>I</i></button>
								<button type="button" class="ed-btn-icon" data-ed-format="underline" data-ed-tip="Underline"><u>U</u></button>
								<button type="button" class="ed-btn-icon" data-ed-format="strikeThrough" data-ed-tip="Strikethrough"><s>S</s></button>
							</div>
							<div class="ed-button-group ed-button-group-grow">
								<select class="ed-select" data-ed-control="char-align-h" data-ed-tip="Horizontal alignment">
									<option value="left">Left</option>
									<option value="center">Center</option>
									<option value="right">Right</option>
								</select>
								<select class="ed-select" data-ed-control="char-align-v" data-ed-tip="Vertical alignment">
									<option value="flex-start">Top</option>
									<option value="center">Middle</option>
									<option value="flex-end">Bottom</option>
								</select>
							</div>
						</div>

						<div class="ed-prop ed-mt-xs">
							<button type="button" class="ed-disclosure" data-ed-action="toggle-padding" aria-expanded="false" aria-label="Expand Padding TRBL">&#9662;</button>
							<span class="ed-ico material-symbols-outlined ed-scrub" data-ed-scrub="box-padding" data-ed-tip="Padding (px)">padding</span>
							<input type="range" min="0" max="128" step="1" value="24" data-ed-control="box-padding">
							<input type="number" min="0" max="128" step="1" value="24" data-ed-num="box-padding">
						</div>
						<div class="ed-sub-group ed-indent-trbl" data-ed-subpanel="padding-trbl" hidden>
							<div class="ed-grid-4">
								<label class="ed-prop-compact"><span class="ed-ico material-symbols-outlined ed-scrub" data-ed-scrub="box-pad-t" data-ed-tip="Padding Top (px)">border_top</span><input type="number" min="0" max="128" step="1" value="24" data-ed-num="box-pad-t"></label>
								<label class="ed-prop-compact"><span class="ed-ico material-symbols-outlined ed-scrub" data-ed-scrub="box-pad-b" data-ed-tip="Padding Bottom (px)">border_bottom</span><input type="number" min="0" max="128" step="1" value="24" data-ed-num="box-pad-b"></label>
								<label class="ed-prop-compact"><span class="ed-ico material-symbols-outlined ed-scrub" data-ed-scrub="box-pad-l" data-ed-tip="Padding Left (px)">border_left</span><input type="number" min="0" max="128" step="1" value="24" data-ed-num="box-pad-l"></label>
								<label class="ed-prop-compact"><span class="ed-ico material-symbols-outlined ed-scrub" data-ed-scrub="box-pad-r" data-ed-tip="Padding Right (px)">border_right</span><input type="number" min="0" max="128" step="1" value="24" data-ed-num="box-pad-r"></label>
							</div>
						</div>
					</div>
				</section>

				<section class="ed-panel" data-ed-panel="ipax">
					<header class="ed-panel-header">
						<span>Lucid Glass</span>
						<button type="button" class="ed-panel-toggle" data-ed-action="toggle-panel" aria-expanded="true" aria-label="Collapse Lucid Glass">&#9662;</button>
					</header>
					<div class="ed-panel-body" data-ed-role="panel-body">
						<label class="ed-prop">
							<span class="ed-label ed-label-short">Mode</span>
							<select class="ed-select" data-ed-control="ipax-mode">
								<option value="default">Default</option>
								<option value="tricontrast">Tricontrast</option>
							</select>
						</label>

						<div class="ed-sub-group" data-ed-subgroup="ipax-box">
							<div class="ed-sub-header">
								<label class="ed-sub-toggle">
									<input type="checkbox" data-ed-control="ipax-box-on" checked>
									<span>Container <code class="ed-code-tag">--ipax-backdrop</code></span>
								</label>
								<button type="button" class="ed-disclosure" data-ed-action="toggle-subpanel" aria-expanded="true" aria-label="Collapse Container">&#9662;</button>
							</div>
							<div class="ed-sub-body" data-ed-role="sub-body">
								<div class="ed-grid-2">
									<label class="ed-prop-mini">
										<span class="ed-ico material-symbols-outlined ed-scrub" data-ed-scrub="ipax-contrast" data-ed-tip="Contrast ratio (1–15)">contrast</span>
										<input type="range" min="1" max="15" step="0.5" value="4.5" data-ed-control="ipax-contrast">
										<input type="number" min="1" max="15" step="0.5" value="4.5" data-ed-num="ipax-contrast">
									</label>
									<label class="ed-prop-mini">
										<span class="ed-ico material-symbols-outlined ed-scrub" data-ed-scrub="ipax-blur" data-ed-tip="Backdrop blur (px)">deblur</span>
										<input type="range" min="0" max="32" step="1" value="8" data-ed-control="ipax-blur">
										<input type="number" min="0" max="32" step="1" value="8" data-ed-num="ipax-blur">
									</label>
								</div>

								<div class="ed-prop">
									<button type="button" class="ed-disclosure" data-ed-action="toggle-feather" aria-expanded="false" aria-label="Expand Feather TRBL">&#9662;</button>
									<span class="ed-ico material-symbols-outlined ed-scrub" data-ed-scrub="ipax-feather" data-ed-tip="Feather (px)">vignette</span>
									<input type="range" min="0" max="128" step="1" value="14" data-ed-control="ipax-feather">
									<input type="number" min="0" max="128" step="1" value="14" data-ed-num="ipax-feather">
								</div>
								<div class="ed-sub-group ed-indent-trbl" data-ed-subpanel="feather-trbl" hidden>
									<div class="ed-grid-4">
										<label class="ed-prop-compact"><span class="ed-ico material-symbols-outlined ed-scrub" data-ed-scrub="ipax-feather-t" data-ed-tip="Feather Top (px)">border_top</span><input type="number" min="0" max="128" step="1" value="14" data-ed-num="ipax-feather-t"></label>
										<label class="ed-prop-compact"><span class="ed-ico material-symbols-outlined ed-scrub" data-ed-scrub="ipax-feather-b" data-ed-tip="Feather Bottom (px)">border_bottom</span><input type="number" min="0" max="128" step="1" value="14" data-ed-num="ipax-feather-b"></label>
										<label class="ed-prop-compact"><span class="ed-ico material-symbols-outlined ed-scrub" data-ed-scrub="ipax-feather-l" data-ed-tip="Feather Left (px)">border_left</span><input type="number" min="0" max="128" step="1" value="14" data-ed-num="ipax-feather-l"></label>
										<label class="ed-prop-compact"><span class="ed-ico material-symbols-outlined ed-scrub" data-ed-scrub="ipax-feather-r" data-ed-tip="Feather Right (px)">border_right</span><input type="number" min="0" max="128" step="1" value="14" data-ed-num="ipax-feather-r"></label>
									</div>
								</div>
							</div>
						</div>

						<div class="ed-sub-group is-disabled" data-ed-subgroup="ipax-text">
							<div class="ed-sub-header">
								<label class="ed-sub-toggle">
									<input type="checkbox" data-ed-control="ipax-text-on">
									<span class="ed-ico material-symbols-outlined" data-ed-tip="Glyph contour outline">format_shapes</span>
									<span>Glyph Contour <code class="ed-code-tag">--ipax-text</code></span>
								</label>
								<button type="button" class="ed-disclosure" data-ed-action="toggle-subpanel" aria-expanded="true" aria-label="Collapse Glyph Contour">&#9662;</button>
							</div>
							<div class="ed-sub-body" data-ed-role="sub-body">
								<div class="ed-grid-2">
									<label class="ed-prop-mini">
										<span class="ed-ico material-symbols-outlined ed-scrub" data-ed-scrub="ipax-text-contrast" data-ed-tip="Text contrast ratio (1–15)">contrast</span>
										<input type="range" min="1" max="15" step="0.5" value="7" data-ed-control="ipax-text-contrast" disabled>
										<input type="number" min="1" max="15" step="0.5" value="7" data-ed-num="ipax-text-contrast" disabled>
									</label>
									<label class="ed-prop-mini">
										<span class="ed-ico material-symbols-outlined ed-scrub" data-ed-scrub="ipax-text-blur" data-ed-tip="Glyph background blur (px)">deblur</span>
										<input type="range" min="0" max="24" step="1" value="0" data-ed-control="ipax-text-blur" disabled>
										<input type="number" min="0" max="24" step="1" value="0" data-ed-num="ipax-text-blur" disabled>
									</label>
									<label class="ed-prop-mini">
										<span class="ed-ico material-symbols-outlined ed-scrub" data-ed-scrub="ipax-text-halo" data-ed-tip="Halo radius (px)">adjust</span>
										<input type="range" min="0" max="36" step="1" value="12" data-ed-control="ipax-text-halo" disabled>
										<input type="number" min="0" max="36" step="1" value="12" data-ed-num="ipax-text-halo" disabled>
									</label>
									<label class="ed-prop-mini">
										<span class="ed-ico material-symbols-outlined ed-scrub" data-ed-scrub="ipax-text-spread" data-ed-tip="Spread plateau (%)">open_in_full</span>
										<input type="range" min="0" max="100" step="1" value="35" data-ed-control="ipax-text-spread" disabled>
										<input type="number" min="0" max="100" step="1" value="35" data-ed-num="ipax-text-spread" disabled>
									</label>
									<label class="ed-prop-mini">
										<span class="ed-ico material-symbols-outlined ed-scrub" data-ed-scrub="ipax-text-x" data-ed-tip="Offset X (px)">east</span>
										<input type="range" min="-24" max="24" step="1" value="0" data-ed-control="ipax-text-x" disabled>
										<input type="number" min="-24" max="24" step="1" value="0" data-ed-num="ipax-text-x" disabled>
									</label>
									<label class="ed-prop-mini">
										<span class="ed-ico material-symbols-outlined ed-scrub" data-ed-scrub="ipax-text-y" data-ed-tip="Offset Y (px)">south</span>
										<input type="range" min="-24" max="24" step="1" value="0" data-ed-control="ipax-text-y" disabled>
										<input type="number" min="-24" max="24" step="1" value="0" data-ed-num="ipax-text-y" disabled>
									</label>
								</div>
							</div>
						</div>
					</div>
				</section>
			</div>

			<div class="ed-inspector-bottom">
				<a href="https://www.bustelo.com.ar/en/" target="_blank" rel="noopener" class="ed-btn ed-btn-link ed-by">
					v.0.1.13 &bull; 2026, Santiago Bustelo
				</a>
				<div class="ed-telemetry-bar" data-ed-role="perf-telemetry">Engine: initializing...</div>
				<footer class="ed-inspector-footer" data-ed-role="storage-footer">
					<span class="ed-storage-status" data-ed-role="storage-status">Clean state (VFS: 0 bytes)</span>
					<button type="button" class="ed-btn ed-btn-xs" data-ed-action="purge-db" data-ed-tip="Purge VFS auto-saved state">Purge</button>
				</footer>
			</div>
		</aside>
	</div>

	<div class="ed-tooltip" data-ed-role="tooltip" hidden></div>

	<template data-ed-tpl="box">
		<div class="ed-box">
			<div class="ed-glass" data-ipax-backdrop data-ipax-text>
				<div class="ed-box-bg"></div>
				<div class="ed-box-text" contenteditable="true"></div>
			</div>
			<span class="ed-handle" data-dir="nw"></span>
			<span class="ed-handle" data-dir="n"></span>
			<span class="ed-handle" data-dir="ne"></span>
			<span class="ed-handle" data-dir="e"></span>
			<span class="ed-handle" data-dir="se"></span>
			<span class="ed-handle" data-dir="s"></span>
			<span class="ed-handle" data-dir="sw"></span>
			<span class="ed-handle" data-dir="w"></span>
		</div>
	</template>

	<template data-ed-tpl="font-item">
		<li class="ed-combo-item">
			<span data-ed-role="font-label"></span>
			<span class="ed-combo-tag" data-ed-role="font-tag"></span>
		</li>
	</template>

	<?php echo $distTag; ?>
	<?php echo $jsTags; ?>
</body>
</html>
<?php
});