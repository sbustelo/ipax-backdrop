<?php
// PATH: examples/php/perf-modal.php
?>
<dialog class="perf-modal" data-perf-modal="bg">
	<div class="perf-modal-card">
		<header class="perf-modal-head">
			<h2 class="perf-modal-title">Background Image Pool</h2>
			<button type="button" class="perf-modal-close" data-perf-action="pool-close" aria-label="Close">&times;</button>
		</header>
		<div class="perf-modal-toolbar">
			<button type="button" class="perf-modal-btn" data-perf-action="pool-random">&#127922; Generate Random</button>
			<label class="perf-modal-btn perf-modal-btn-primary perf-modal-upload">
				<span>&#128193; Load Local Images&hellip;</span>
				<input type="file" accept="image/*" multiple data-perf-control="pool-files">
			</label>
			<span class="perf-modal-meta" data-perf-role="pool-summary">0 images</span>
		</div>
		<div class="perf-modal-drop" data-perf-role="pool-drop">
			Drop image files here or use <strong>&#128193; Load Local Images</strong> to test real photography.
		</div>
		<div class="perf-modal-grid" data-perf-role="pool-grid"></div>
	</div>
	<template data-perf-tpl="pool-item">
		<div class="perf-modal-item">
			<img src="" alt="" loading="lazy">
			<button type="button" class="perf-modal-rm" data-perf-remove="" aria-label="Remove image">&times;</button>
		</div>
	</template>
</dialog>