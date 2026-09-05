<?php
/**
 * TruWidgets — enqueue selected widgets on the front-end.
 *
 * Reads which widgets are enabled from Settings > TruChat and injects the
 * appropriate <script> tags with dealer branding, WhatsApp number and
 * the webhook URL for lead capture. Per-widget position settings (mode,
 * side, bottom offset, inline target) are passed as data attributes.
 *
 * The widgets sit in the plugin's assets/widgets/ directory.
 * Canonical source of truth lives in packages/ — do NOT edit the deployed
 * copies directly; copy from canonical, then re-deploy.
 */

if (!defined('ABSPATH')) exit;

function truwidgets_enabled() {
    $list = truchat_opt('enabled_widgets', 'afford,repay,form,book,share');
    return array_map('trim', explode(',', $list));
}

function truwidgets_enqueue() {
    if (!is_singular()) return; // only on single pages/posts (or use is_front_page() etc.)

    $enabled = truwidgets_enabled();
    if (empty($enabled)) return;

    $dealer  = truchat_opt('dealer_name', 'Your Dealership');
    $slug    = sanitize_title($dealer);
    $wa      = preg_replace('/\D/', '', truchat_opt('sales_whatsapp', ''));
    $accent  = truchat_opt('brand_color', '#1466E0');
    $flow    = home_url('/');
    $brand   = truchat_opt('brand_line', $dealer);
    $site    = home_url('/');

    // Widget base URL — serves from plugin's assets/widgets/ directory.
    $base = TRUCHAT_URL . 'assets/widgets/';

    // Default inline finance calc target (overridden per-widget below).
    $repayTarget = truchat_opt('repay_target', '#finance-calc');

    // Per-widget position defaults.
    $defaults = array(
        'afford' => array('mode' => 'float', 'side' => 'right', 'bottom' => '88',   'target' => ''),
        'repay'  => array('mode' => 'inline', 'side' => 'right', 'bottom' => '24',   'target' => '#finance-calc'),
        'form'   => array('mode' => 'float', 'side' => 'left',  'bottom' => '24',   'target' => '#contact-form'),
        'book'   => array('mode' => 'float', 'side' => 'left',  'bottom' => '110',  'target' => '#book-slot'),
    );

    foreach ($enabled as $w) {
        $w = strtolower(trim($w));
        if ($w === '') continue;

        $src = $base . 'tru-' . $w . '.js';
        $tag = '<script src="' . esc_url($src) . '"';

        $tag .= ' data-dealer="' . esc_attr($dealer) . '"';
        $tag .= ' data-slug="' . esc_attr($slug) . '"';
        $tag .= ' data-flow="' . esc_attr($flow) . '"';
        $tag .= ' data-wa="' . esc_attr($wa) . '"';
        $tag .= ' data-accent="' . esc_attr($accent) . '"';
        $tag .= ' data-brand="' . esc_attr($brand) . '"';

        // Per-widget position settings.
        $pos = isset($defaults[$w]) ? $defaults[$w] : array();
        $mode   = truchat_opt($w . '_mode',  $pos['mode']  ?? 'float');
        $side   = truchat_opt($w . '_side',  $pos['side']  ?? 'right');
        $bottom = truchat_opt($w . '_bottom', $pos['bottom'] ?? '24');
        $target = truchat_opt($w . '_target', $pos['target'] ?? '');

        // Repay inline target overrides the global setting.
        if ($w === 'repay') {
            $target = $repayTarget;
        }

        $tag .= ' data-mode="' . esc_attr($mode) . '"';
        $tag .= ' data-position="' . esc_attr($side) . '"';
        $tag .= ' data-bottom="' . esc_attr($bottom) . 'px"';

        if ($w === 'form') {
            $tag .= ' data-fields="vehicle,tradein,finance,location"';
        }
        if ($w === 'share') {
            $tag .= ' data-site="' . esc_attr($site) . '"';
        }
        if ($target !== '' && $mode === 'inline') {
            $tag .= ' data-target="' . esc_attr($target) . '"';
        }

        $tag .= '></script>';
        echo "\n" . $tag . "\n";
    }
}

// Hook late so the page content is already rendered.
add_action('wp_footer', 'truwidgets_enqueue', 99);
