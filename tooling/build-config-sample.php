<?php
/**
 * ============================================================================
 * BUILDER CONFIGURATION SAMPLE
 * 
 * Fill with production settings and rename this file to:
 * _build-config.php (with leading underscore to prevent VCS tracking).
 * ============================================================================
 */

return [
    // Output target path relative to the repository root
    'output_file' => 'dist/ipax-backdrop.js',

    // Console / Browser output toggle (true: print success message, false: silent)
    'echo' => true,

    // Source directories in strict order of resolution and bundling
    'sources' => [
        'lib',
        'src'
    ],

    // Minification parameters (Phase 2)
    'minify' => [
        'enabled' => true,
        'api_url' => 'https://www.toptal.com/developers/javascript-minifier/api/raw',
        'timeout' => 10
    ]
];