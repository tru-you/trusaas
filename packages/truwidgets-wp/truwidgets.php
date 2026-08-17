<?php
/**
 * Plugin Name: TruWidgets — Dealer Widgets
 * Description: Drop-in dealer widgets (affordability, finance, enquiry, booking, share) for any WordPress site. No CRM, no chatbot — one settings page brands them and injects the loader. Widget code is served from the TruSaaS CDN, so a fix ships to every site at once.
 * Version:     1.0.0
 * Author:      TruSaaS
 * License:     Proprietary
 *
 * This is the CANONICAL, dealer-agnostic rig. It carries no dealer-specific
 * content — everything (name, colour, WhatsApp, lead destination, which widgets,
 * placement) comes from Settings → TruWidgets. Install it unchanged on any
 * dealer's site and configure from the admin.
 *
 * It injects a SINGLE loader tag:
 *   <script src="{cdn}/tru-loader/tru-loader.js" data-…></script>
 * The loader (canonical source: packages/standalone/) mounts the enabled widgets,
 * handles placement/stacking, responsiveness and per-widget config forwarding.
 *
 * Lead delivery is the dealer's own: a webhook (Zapier/CRM) and/or a CallMeBot
 * WhatsApp ping — no data flows through TruSaaS.
 */

if (!defined('ABSPATH')) exit;

define('TRUW_VER', '1.0.0');
define('TRUW_DIR', plugin_dir_path(__FILE__));
define('TRUW_URL', plugin_dir_url(__FILE__));
define('TRUW_OPT', 'truwidgets_settings');

/** Read a single setting from the option array. */
function truw_opt($key, $default = '') {
    $o = get_option(TRUW_OPT, array());
    return (is_array($o) && isset($o[$key]) && $o[$key] !== '') ? $o[$key] : $default;
}

require_once TRUW_DIR . 'includes/settings.php';
require_once TRUW_DIR . 'includes/inject.php';

/** Friendly "Settings" link on the Plugins screen. */
add_filter('plugin_action_links_' . plugin_basename(__FILE__), function ($links) {
    $url = admin_url('options-general.php?page=truwidgets');
    array_unshift($links, '<a href="' . esc_url($url) . '">Settings</a>');
    return $links;
});
