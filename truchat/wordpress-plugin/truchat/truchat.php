<?php
/**
 * Plugin Name: TruChat — Ray (Your Car Guy)
 * Description: AI showroom assistant for Your Car Guy. Conversational Claude-powered chatbot with knowledge base, stock search, slot booking, WhatsApp handoff and email confirmations (customer + dealer).
 * Version:     1.1.0
 * Author:      TruSaaS
 * License:     Proprietary
 *
 * Everything Ray needs lives in this one plugin:
 *   - Settings page (API key, model, emails, knowledge base)   → Settings > TruChat
 *   - REST endpoint  POST /wp-json/truchat/v1/chat             → the LLM brain
 *   - Front-end widget enqueue (the floating chat bubble)
 *
 * The Claude API key never leaves the server. The browser only ever talks to
 * this WordPress site.
 */

if (!defined('ABSPATH')) exit;

define('TRUCHAT_VER', '1.1.0');
define('TRUCHAT_DIR', plugin_dir_path(__FILE__));
define('TRUCHAT_URL', plugin_dir_url(__FILE__));
define('TRUCHAT_OPT', 'truchat_settings');

require_once TRUCHAT_DIR . 'includes/knowledge.php';
require_once TRUCHAT_DIR . 'includes/chat.php';
require_once TRUCHAT_DIR . 'includes/email.php';
require_once TRUCHAT_DIR . 'includes/leads.php';
require_once TRUCHAT_DIR . 'includes/settings.php';

register_activation_hook(__FILE__, 'truchat_leads_install');

/* ------------------------------------------------------------------ */
/*  Settings helper                                                    */
/* ------------------------------------------------------------------ */

function truchat_opt($key, $default = '') {
    $o = get_option(TRUCHAT_OPT, array());
    return isset($o[$key]) && $o[$key] !== '' ? $o[$key] : $default;
}

/** Chat icon / logo — a chosen image, else the bundled dealership icon. */
function truchat_logo_url() {
    return truchat_opt('logo_url', TRUCHAT_URL . 'assets/ycg-icon.jpg');
}

/** True when the "TruChat by TruSaaS" credit should be hidden. */
function truchat_white_label() {
    return truchat_opt('white_label', '0') === '1';
}

/* ------------------------------------------------------------------ */
/*  REST endpoint:  POST /wp-json/truchat/v1/chat                      */
/* ------------------------------------------------------------------ */

add_action('rest_api_init', function () {
    register_rest_route('truchat/v1', '/chat', array(
        'methods'             => 'POST',
        'callback'            => 'truchat_rest_chat',
        'permission_callback' => '__return_true', // public site chatbot
    ));
});

function truchat_rest_chat(WP_REST_Request $req) {
    // Light rate-limit: 30 requests / 5 min per IP.
    $ip  = truchat_client_ip();
    $key = 'truchat_rl_' . md5($ip);
    $n   = (int) get_transient($key);
    if ($n > 30) {
        return new WP_REST_Response(array(
            'reply'   => "You're sending messages very fast — give me a moment, or reach the yard on WhatsApp.",
            'actions' => array(array('type' => 'whatsapp')),
            'session' => (array) $req->get_param('session'),
        ), 429);
    }
    set_transient($key, $n + 1, 5 * MINUTE_IN_SECONDS);

    $body = array(
        'messages' => $req->get_param('messages'),
        'session'  => $req->get_param('session'),
        'catalog'  => $req->get_param('catalog'),
    );

    $result = truchat_handle_chat($body);
    return new WP_REST_Response($result, 200);
}

function truchat_client_ip() {
    foreach (array('HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR') as $h) {
        if (!empty($_SERVER[$h])) {
            $ip = explode(',', $_SERVER[$h])[0];
            return trim($ip);
        }
    }
    return '0.0.0.0';
}

/* ------------------------------------------------------------------ */
/*  Front-end widget enqueue                                           */
/* ------------------------------------------------------------------ */

add_action('wp_enqueue_scripts', function () {
    if (truchat_opt('enabled', '1') !== '1') return;
    if (truchat_opt('api_key', '') === '') return; // don't show a broken bubble before setup

    $assets = TRUCHAT_URL . 'assets/';
    wp_enqueue_script('truchat-qualifier', $assets . 'qualifier.js', array(), TRUCHAT_VER, true);
    wp_enqueue_script('truchat-core', $assets . 'chat-core.js', array('truchat-qualifier'), TRUCHAT_VER, true);
    wp_enqueue_script('truchat-widget', $assets . 'widget.js', array('truchat-core'), TRUCHAT_VER, true);

    // Inject config (no config.js needed — everything comes from the settings page).
    $config = array(
        'assistantName'   => 'Ray',
        'dealerName'      => truchat_opt('dealer_name', 'Your Car Guy'),
        'brandLine'       => truchat_opt('brand_line', 'Your Car Guy · Port Elizabeth'),
        'brandRed'        => truchat_opt('brand_color', '#e30613'),
        'logoUrl'         => truchat_logo_url(),
        'fabIconUrl'      => truchat_logo_url(),
        'showCredit'      => !truchat_white_label(),
        'personalWhatsApp'=> truchat_opt('sales_whatsapp', '27834659921'),
        'salesWhatsApp'   => truchat_opt('sales_whatsapp', '27834659921'),
        'chatApi'         => esc_url_raw(rest_url('truchat/v1/chat')),
        'greeting'        => truchat_opt('greeting', "Hi — I'm **Ray** at **Your Car Guy**, Newton Park.\n\nAsk me anything — **stock**, **finance**, **trade-ins**, **test drives**, or **hours**. How can I help?"),
        'suggestions'     => array('Browse stock', 'Trade-in valuation', 'Book test drive', 'Finance help'),
        'stockApi'        => truchat_opt('stock_api', ''),
        'catalog'         => array(), // live feed handled server-side
    );

    // Inject config just before qualifier.js runs (it reads window.RAY_TRUCHAT_CONFIG).
    wp_add_inline_script('truchat-qualifier', 'window.RAY_TRUCHAT_CONFIG = ' . wp_json_encode($config) . ';', 'before');
}, 5);
