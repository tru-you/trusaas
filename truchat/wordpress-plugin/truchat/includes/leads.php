<?php
/**
 * TruChat leads — server-side storage, API and admin screen.
 *
 * Every booking / captured lead is written to a custom table so it survives
 * across devices and browsers (the old localStorage portal only saw its own
 * browser). Leads are viewable two ways:
 *   1. WordPress admin  → Settings menu → "TruChat Leads"
 *   2. Standalone portal (portal.html) → REST API, PIN-protected
 */

if (!defined('ABSPATH')) exit;

function truchat_leads_table() {
    global $wpdb;
    return $wpdb->prefix . 'truchat_leads';
}

/** Create / migrate the leads table (runs on activation). */
function truchat_leads_install() {
    global $wpdb;
    $table   = truchat_leads_table();
    $charset = $wpdb->get_charset_collate();
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta("CREATE TABLE $table (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        created_at DATETIME NOT NULL,
        name VARCHAR(120) DEFAULT '',
        phone VARCHAR(40) DEFAULT '',
        email VARCHAR(160) DEFAULT '',
        interest VARCHAR(255) DEFAULT '',
        appointment VARCHAR(255) DEFAULT '',
        tradein VARCHAR(255) DEFAULT '',
        finance TINYINT(1) DEFAULT 0,
        summary TEXT,
        source VARCHAR(40) DEFAULT 'chat',
        status VARCHAR(20) DEFAULT 'new',
        PRIMARY KEY  (id),
        KEY created_at (created_at),
        KEY status (status)
    ) $charset;");
}

/**
 * Store (or update) a lead. De-dupes against a recent lead with the same phone
 * or email so multiple tool calls in one conversation don't create duplicates.
 */
function truchat_store_lead($session, $summary) {
    global $wpdb;
    $table = truchat_leads_table();

    $data = array(
        'name'        => substr((string) ($session['name'] ?? ''), 0, 120),
        'phone'       => substr((string) ($session['phone'] ?? ''), 0, 40),
        'email'       => substr((string) ($session['email'] ?? ''), 0, 160),
        'interest'    => substr((string) ($session['vehicleInterest'] ?? ''), 0, 255),
        'appointment' => substr((string) ($session['appointment'] ?? ''), 0, 255),
        'tradein'     => substr((string) ($session['tradeInDetails'] ?? ''), 0, 255),
        'finance'     => !empty($session['financeInterest']) ? 1 : 0,
        'summary'     => (string) $summary,
        'source'      => 'chat',
    );

    // Find a recent matching lead (last 6 hours) to update instead of duplicate.
    $recent = null;
    if ($data['phone'] || $data['email']) {
        $recent = $wpdb->get_row($wpdb->prepare(
            "SELECT id FROM $table WHERE ((phone = %s AND phone <> '') OR (email = %s AND email <> ''))
             AND created_at > (NOW() - INTERVAL 6 HOUR) ORDER BY id DESC LIMIT 1",
            $data['phone'], $data['email']
        ));
    }

    if ($recent) {
        $wpdb->update($table, $data, array('id' => $recent->id));
        return (int) $recent->id;
    }
    $data['created_at'] = current_time('mysql');
    $data['status']     = 'new';
    $wpdb->insert($table, $data);
    return (int) $wpdb->insert_id;
}

function truchat_get_leads($limit = 200) {
    global $wpdb;
    $table = truchat_leads_table();
    $limit = max(1, min(1000, (int) $limit));
    return $wpdb->get_results("SELECT * FROM $table ORDER BY id DESC LIMIT $limit", ARRAY_A);
}

/* ------------------------------------------------------------------ */
/*  REST API for the standalone portal (PIN-protected)                 */
/* ------------------------------------------------------------------ */

add_action('rest_api_init', function () {
    register_rest_route('truchat/v1', '/leads', array(
        'methods'             => 'GET',
        'callback'            => 'truchat_rest_leads',
        'permission_callback' => '__return_true',
    ));
    register_rest_route('truchat/v1', '/leads/(?P<id>\d+)', array(
        'methods'             => 'POST',
        'callback'            => 'truchat_rest_lead_update',
        'permission_callback' => '__return_true',
    ));
});

function truchat_portal_ok($req) {
    $pin = truchat_opt('portal_pin', '');
    if ($pin === '') return false; // portal disabled until a PIN is set
    return hash_equals($pin, (string) $req->get_param('pin'));
}

/** The portal may be opened from any origin (a phone, a local file) — it's
 *  PIN-protected and sends no credentials, so allow cross-origin on these routes. */
function truchat_leads_response($data, $status) {
    $resp = new WP_REST_Response($data, $status);
    $resp->header('Access-Control-Allow-Origin', '*');
    return $resp;
}

function truchat_rest_leads(WP_REST_Request $req) {
    if (!truchat_portal_ok($req)) return truchat_leads_response(array('error' => 'Invalid PIN'), 401);
    return truchat_leads_response(array(
        'leads'    => truchat_get_leads(300),
        // Lets the standalone portal skin itself to the dealership.
        'branding' => array(
            'dealer' => truchat_opt('dealer_name', 'Your Car Guy'),
            'color'  => truchat_opt('brand_color', '#e30613'),
            'logo'   => truchat_logo_url(),
        ),
    ), 200);
}

function truchat_rest_lead_update(WP_REST_Request $req) {
    if (!truchat_portal_ok($req)) return truchat_leads_response(array('error' => 'Invalid PIN'), 401);
    global $wpdb;
    $id = (int) $req['id'];
    $status = sanitize_text_field($req->get_param('status'));
    if (!in_array($status, array('new', 'contacted', 'closed'), true)) {
        return truchat_leads_response(array('error' => 'Bad status'), 400);
    }
    $wpdb->update(truchat_leads_table(), array('status' => $status), array('id' => $id));
    return truchat_leads_response(array('ok' => true), 200);
}

/* ------------------------------------------------------------------ */
/*  WordPress admin screen: Settings → TruChat Leads                   */
/* ------------------------------------------------------------------ */

add_action('admin_menu', function () {
    add_submenu_page('options-general.php', 'TruChat Leads', 'TruChat Leads', 'manage_options', 'truchat-leads', 'truchat_leads_admin_page');
});

function truchat_leads_admin_page() {
    if (!current_user_can('manage_options')) return;
    global $wpdb;
    $table = truchat_leads_table();

    // Handle actions (nonce-protected).
    if (!empty($_GET['tc_action']) && check_admin_referer('truchat_lead')) {
        $id = (int) ($_GET['lead'] ?? 0);
        if ($_GET['tc_action'] === 'contacted') $wpdb->update($table, array('status' => 'contacted'), array('id' => $id));
        if ($_GET['tc_action'] === 'delete')    $wpdb->delete($table, array('id' => $id));
        echo '<div class="updated"><p>Lead updated.</p></div>';
    }

    $leads = truchat_get_leads(300);
    ?>
    <div class="wrap">
        <h1>TruChat Leads <span style="font:400 13px system-ui;color:#666">(<?php echo count($leads); ?> shown)</span></h1>
        <p>Leads captured by Ray. Booking and finance/callback leads also email you and the customer automatically.</p>
        <table class="widefat striped">
            <thead><tr>
                <th>When</th><th>Name</th><th>Phone</th><th>Email</th><th>Interest / Booking</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>
            <?php if (empty($leads)): ?>
                <tr><td colspan="7">No leads yet.</td></tr>
            <?php else: foreach ($leads as $l):
                $wa = preg_replace('/\D/', '', $l['phone']);
                $base = admin_url('options-general.php?page=truchat-leads');
                $contacted = wp_nonce_url($base . '&tc_action=contacted&lead=' . $l['id'], 'truchat_lead');
                $delete    = wp_nonce_url($base . '&tc_action=delete&lead=' . $l['id'], 'truchat_lead');
            ?>
                <tr>
                    <td><?php echo esc_html(mysql2date('d M H:i', $l['created_at'])); ?></td>
                    <td><?php echo esc_html($l['name']); ?></td>
                    <td><?php echo esc_html($l['phone']); ?><?php if ($wa): ?><br><a href="https://wa.me/<?php echo esc_attr($wa); ?>" target="_blank">WhatsApp</a><?php endif; ?></td>
                    <td><?php echo esc_html($l['email']); ?></td>
                    <td>
                        <?php echo esc_html($l['appointment'] ?: $l['interest']); ?>
                        <?php if ($l['tradein']): ?><br><small>Trade-in: <?php echo esc_html($l['tradein']); ?></small><?php endif; ?>
                        <?php if ($l['finance']): ?><br><small>💰 Finance</small><?php endif; ?>
                    </td>
                    <td><?php echo esc_html($l['status']); ?></td>
                    <td>
                        <?php if ($l['status'] === 'new'): ?><a href="<?php echo esc_url($contacted); ?>">Mark contacted</a> · <?php endif; ?>
                        <a href="<?php echo esc_url($delete); ?>" onclick="return confirm('Delete this lead?')" style="color:#b32d2e">Delete</a>
                    </td>
                </tr>
            <?php endforeach; endif; ?>
            </tbody>
        </table>
    </div>
    <?php
}
