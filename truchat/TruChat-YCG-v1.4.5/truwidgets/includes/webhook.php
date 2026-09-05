<?php
/**
 * TruWidgets webhook — REST endpoint for widget lead capture.
 *
 * Widgets (TruAfford, TruRepay, TruForm, TruBook) POST leads here.
 * Stores in the same wp_truchat_leads table Ray uses.
 * Fires CallMeBot WhatsApp alert + dealer email (same as chat leads).
 */

if (!defined('ABSPATH')) exit;

add_action('rest_api_init', function () {
    register_rest_route('truwidgets/v1', '/lead', array(
        'methods'             => 'POST',
        'callback'            => 'truwidgets_rest_lead',
        'permission_callback' => '__return_true',
    ));
});

function truwidgets_rest_lead(WP_REST_Request $req) {
    $body = $req->get_json_params();
    if (!is_array($body)) {
        return new WP_REST_Response(array('error' => 'Invalid JSON'), 400);
    }

    $name    = sanitize_text_field($body['firstName'] ?? '');
    $last    = sanitize_text_field($body['lastName'] ?? '');
    $phone   = sanitize_text_field($body['phone'] ?? '');
    $email   = sanitize_email($body['email'] ?? '');
    $source  = sanitize_text_field($body['source'] ?? 'Widget');
    $notes   = sanitize_textarea_field($body['notes'] ?? '');

    if ($name && $last) {
        $name = trim($name . ' ' . $last);
    } elseif ($last) {
        $name = $last;
    }

    // Build session array compatible with truchat_store_lead().
    $session = array(
        'name'        => $name,
        'phone'       => $phone,
        'email'       => $email,
        'interest'    => sanitize_text_field($body['vehicle'] ?? $body['interest'] ?? ''),
        'appointment' => '',
        'tradein'     => '',
        'finance'     => !empty($body['finance']),
    );

    // Extract appointment from notes if present (TruBook).
    if (preg_match('/Appointment:\s*(.+)/i', $notes, $m)) {
        $session['appointment'] = trim($m[1]);
    }

    // Extract trade-in from notes if present.
    if (preg_match('/Trade-in:\s*(.+)/i', $notes, $m)) {
        $session['tradein'] = trim($m[1]);
    }

    $id = truchat_store_lead($session, $notes);

    // Fire notifications (same path as Ray chat leads).
    $lead = array_merge($session, array('summary' => $notes, 'source' => $source));
    truchat_send_lead_emails($lead, $notes);

    return new WP_REST_Response(array('ok' => true, 'id' => $id), 200);
}
