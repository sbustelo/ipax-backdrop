<?php
// PATH: examples/php/perf-config.php

$PERF_BENCHMARKS = [
	[
		'id' => 'longpage',
		'label' => 'Long Page (400 Boxes)',
		'php' => 'performance-longpage.php',
		'html' => 'performance-longpage.html'
	],
	[
		'id' => 'motion',
		'label' => 'Motion & Presets',
		'php' => 'performance-motion.php',
		'html' => 'performance-motion.html'
	]
];