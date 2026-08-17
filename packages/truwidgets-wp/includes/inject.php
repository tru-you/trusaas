<?php
/**
 * TruWidgets — front-end injector.
 *
 * Builds one TruLoader <script> tag from the settings and prints it in the
 * footer. The loader forwards every data-<widget>-<attr> to the right widget,
 * so per-widget options map cleanly (data-repay-price → the calculator's price).
 */

if (!defined('ABSPATH')) exit;

/** The enabled widgets, as an array, from the per-widget checkboxes. */
function truw_enabled_list() {
    $all = array('afford', 'repay', 'form', 'book', 'share');
    $on  = array();
    foreach ($all as $w) {
        if (truw_opt('w_' . $w, '') === '1') $on[] = $w;
    }
    return $on;
}

/**
 * Should widget $w show on the CURRENT request? Driven by <w>_show:
 *   everywhere (default) | home | singular | path | ids
 * For "path"/"ids", <w>_match holds the URL substring or comma-separated IDs.
 */
function truw_widget_visible($w) {
    switch (truw_opt($w . '_show', 'everywhere')) {
        case 'home':
            return (is_front_page() || is_home());
        case 'singular':
            return is_singular();
        case 'path':
            $needle = truw_opt($w . '_match', '');
            if ($needle === '') return true;
            $path = isset($_SERVER['REQUEST_URI'])
                ? (string) wp_parse_url(wp_unslash($_SERVER['REQUEST_URI']), PHP_URL_PATH) : '';
            return (strpos($path, $needle) !== false);
        case 'ids':
            $ids = array_filter(array_map('trim', explode(',', truw_opt($w . '_match', ''))));
            return (is_singular() && in_array((string) get_queried_object_id(), $ids, true));
        case 'everywhere':
        default:
            return true;
    }
}

/** Emit the loader tag in the footer. */
function truw_inject() {
    // Enabled AND visible on this page.
    $widgets = array_values(array_filter(truw_enabled_list(), 'truw_widget_visible'));
    if (empty($widgets)) return;

    $base = rtrim(truw_opt('cdn_base', 'https://cdn.tru-saas.com'), '/');
    $src  = $base . '/tru-loader/tru-loader.js';
    $wa   = preg_replace('/\D/', '', truw_opt('sales_whatsapp', ''));

    // Shared / brand.
    $attrs = array();
    $attrs['data-dealer'] = truw_opt('dealer_name', get_bloginfo('name'));
    $attrs['data-accent'] = truw_opt('brand_color', '#1466E0');
    if (truw_opt('accent2'))                                   $attrs['data-accent-2'] = truw_opt('accent2');
    if (truw_opt('use_text', '') === '1' && truw_opt('text_color')) $attrs['data-text'] = truw_opt('text_color');
    $scale = truw_opt('scale', '');
    if ($scale !== '' && $scale !== '1')                       $attrs['data-scale'] = $scale;
    $attrs['data-theme'] = truw_opt('theme', 'dark');
    if ($wa)                                                   $attrs['data-wa'] = $wa;
    $attrs['data-widgets'] = implode(',', $widgets);

    // Lead delivery.
    if (truw_opt('webhook'))       $attrs['data-webhook'] = truw_opt('webhook');
    if (truw_opt('callmebot_key')) {
        $attrs['data-callmebot-key']   = truw_opt('callmebot_key');
        $attrs['data-callmebot-phone'] = preg_replace('/\D/', '', truw_opt('callmebot_phone', $wa));
    }

    // Per-widget placement + options (prefixed; the loader strips the prefix).
    if (in_array('afford', $widgets)) {
        $attrs['data-afford-position'] = truw_opt('afford_side', 'left');
    }
    if (in_array('repay', $widgets)) {
        $attrs['data-repay-position'] = truw_opt('repay_side', 'left');
        $attrs['data-repay-mode']     = truw_opt('repay_mode', 'float');
        if (truw_opt('repay_mode', 'float') === 'inline' && truw_opt('repay_target')) {
            $attrs['data-repay-target'] = truw_opt('repay_target');
        }
        if (truw_opt('repay_price'))   $attrs['data-repay-price']   = truw_opt('repay_price');
        if (truw_opt('repay_vehicle')) $attrs['data-repay-vehicle'] = truw_opt('repay_vehicle');
    }
    if (in_array('form', $widgets)) {
        $attrs['data-form-position'] = truw_opt('form_side', 'right');
    }
    if (in_array('book', $widgets) && truw_opt('book_address')) {
        $attrs['data-book-address'] = truw_opt('book_address');
    }
    if (in_array('share', $widgets)) {
        $attrs['data-share-site'] = truw_opt('share_site', home_url('/'));
        if (truw_opt('share_vehicle_path')) {
            $attrs['data-share-vehicle-path'] = truw_opt('share_vehicle_path');
        }
    }

    // Build and print.
    $out = "\n<!-- TruWidgets " . esc_attr(TRUW_VER) . " -->\n<script src=\"" . esc_url($src) . "\"";
    foreach ($attrs as $k => $v) {
        $out .= "\n        " . $k . '="' . esc_attr($v) . '"';
    }
    $out .= "></script>\n";
    echo $out;
}
add_action('wp_footer', 'truw_inject', 99);
