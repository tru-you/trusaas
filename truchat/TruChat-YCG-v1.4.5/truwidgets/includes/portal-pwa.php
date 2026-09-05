<?php
/**
 * TruDealer PWA Portal — serves the installable leads portal from WordPress.
 *
 * Route: /tru-portal/ (or whatever slug is configured).
 * The PWA is a single-page app that connects to the existing REST API.
 * PIN-protected — same auth as the legacy portal.html.
 */

if (!defined('ABSPATH')) exit;

define('TRUDEALER_PORTAL_SLUG', 'tru-portal');

// Serve the PWA portal at /tru-portal/.
add_action('init', function () {
    add_rewrite_rule('^' . TRUDEALER_PORTAL_SLUG . '/?$', 'index.php?truportal=1', 'top');
    add_rewrite_rule('^' . TRUDEALER_PORTAL_SLUG . '/(.+)$', 'index.php?truportal=1&truportal_file=$matches[1]', 'top');
});

add_filter('query_vars', function ($vars) {
    $vars[] = 'truportal';
    $vars[] = 'truportal_file';
    return $vars;
});

add_action('template_redirect', function () {
    if (!get_query_var('truportal')) return;

    $file = get_query_var('truportal_file');
    $portal_dir = TRUCHAT_DIR . 'pwa-portal/';

    // Serve static assets from the pwa-portal directory.
    $allowed = array('index.html', 'manifest.json', 'sw.js', 'icon-192.png', 'icon-512.png');
    if ($file && in_array($file, $allowed)) {
        $path = $portal_dir . $file;
        if (file_exists($path)) {
            $mime = 'text/html';
            if (substr($file, -5) === '.json') $mime = 'application/json';
            elseif (substr($file, -3) === '.js') $mime = 'application/javascript';
            elseif (substr($file, -4) === '.png') $mime = 'image/png';

            header('Content-Type: ' . $mime);
            header('Cache-Control: public, max-age=3600');
            readfile($path);
            exit;
        }
    }

    // Default: serve index.html (the PWA shell).
    $index = $portal_dir . 'index.html';
    if (file_exists($index)) {
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-cache');
        readfile($index);
        exit;
    }
});

/**
 * Flush rewrite rules on activation so /tru-portal/ resolves.
 */
function truportal_flush_rules() {
    add_rewrite_rule('^' . TRUDEALER_PORTAL_SLUG . '/?$', 'index.php?truportal=1', 'top');
    flush_rewrite_rules();
}
register_activation_hook(TRUCHAT_DIR . 'truchat.php', 'truportal_flush_rules');
