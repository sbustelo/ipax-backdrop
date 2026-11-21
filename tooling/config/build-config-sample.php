<?php
// PATH: tooling/config/build-config-sample.php
/**
 * BUILDER CONFIGURATION SAMPLE
 * Copy to _build-config.php (leading underscore prevents VCS tracking).
 */

return [
    'output_file' => 'dist/ipax-backdrop.js',
    'echo' => true,
    'include_j0_kernel' => true,
    'sources' => [
        'src'
    ],
    'minify' => [
        'enabled' => true,
        'api_url' => 'https://www.toptal.com/developers/javascript-minifier/api/raw',
        'timeout' => 10
    ]
];