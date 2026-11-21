<?php
// PATH: examples/php/perf-nav.php
$perfActiveId = $perfActiveId ?? '';
?>
<label class="perf-nav" data-perf-nav>
	<span class="perf-nav-label">Test:</span>
	<select class="perf-nav-select" data-perf-control="benchmark-nav" aria-label="Select performance benchmark">
		<?php foreach ($PERF_BENCHMARKS as $bench): ?>
		<option value="<?php echo htmlspecialchars($bench['html'], ENT_QUOTES, 'UTF-8'); ?>"<?php echo ($bench['id'] === $perfActiveId) ? ' selected' : ''; ?>><?php echo htmlspecialchars($bench['label'], ENT_QUOTES, 'UTF-8'); ?></option>
		<?php endforeach; ?>
	</select>
</label>