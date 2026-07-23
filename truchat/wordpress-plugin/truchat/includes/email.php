<?php
/**
 * TruChat email (WordPress) — dual confirmation via wp_mail().
 *
 *   1. Dealer alert       → so the yard never misses a lead.
 *   2. Customer confirm   → professional "we've got you" email.
 *
 * Uses WordPress's own mailer (wp_mail). For reliable delivery, install an SMTP
 * plugin (e.g. WP Mail SMTP) and set a proper From address in Settings > TruChat.
 * Never throws — returns a report so chat is never blocked by an email failure.
 */

if (!defined('ABSPATH')) exit;

function truchat_email_row($label, $value) {
    if (!$value) return '';
    return '<tr><td style="padding:6px 12px;color:#64748b;font:600 13px system-ui;white-space:nowrap;vertical-align:top">'
        . esc_html($label) . '</td><td style="padding:6px 12px;color:#0f172a;font:500 14px system-ui">'
        . esc_html($value) . '</td></tr>';
}

function truchat_email_shell($title, $inner) {
    $brand = truchat_opt('brand_color', '#e30613');
    $dealer = truchat_opt('dealer_name', 'Your Car Guy');
    $address = truchat_opt('address', '17 Burt Drive, Newton Park, Port Elizabeth');
    return '<!doctype html><html><body style="margin:0;background:#f1f5f9;padding:24px">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">'
        . '<tr><td style="background:' . esc_attr($brand) . ';padding:18px 22px">'
        . '<table role="presentation" cellpadding="0" cellspacing="0"><tr>'
        . '<td style="padding-right:12px"><img src="' . esc_url(truchat_logo_url()) . '" width="40" height="40" alt="'
        . esc_attr($dealer) . '" style="width:40px;height:40px;border-radius:10px;object-fit:cover;display:block;background:#0a0b10" /></td>'
        . '<td><div style="font:800 18px system-ui;color:#fff">' . esc_html($dealer) . '</div>'
        . '<div style="font:600 12px system-ui;color:rgba(255,255,255,.82);margin-top:2px">' . esc_html($title) . '</div></td>'
        . '</tr></table></td></tr>'
        . '<tr><td style="padding:22px">' . $inner . '</td></tr>'
        . '<tr><td style="padding:14px 22px;border-top:1px solid #e2e8f0;font:500 11px system-ui;color:#94a3b8">'
        . (truchat_white_label() ? '' : 'Sent via TruChat by TruSaaS · ')
        . esc_html($dealer) . ', ' . esc_html($address) . '</td></tr>'
        . '</table></body></html>';
}

function truchat_dealer_email_html($lead) {
    $wa = preg_replace('/\D/', '', $lead['phone'] ?? '');
    $inner = '<p style="font:600 15px system-ui;color:#0f172a;margin:0 0 14px">🚗 New lead from the website chatbot</p>'
        . '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e2e8f0;border-radius:10px">'
        . truchat_email_row('Name', $lead['name'] ?? '')
        . truchat_email_row('Phone', $lead['phone'] ?? '')
        . truchat_email_row('Email', $lead['email'] ?? '')
        . truchat_email_row('Interest', $lead['vehicleInterest'] ?? '')
        . truchat_email_row('Booking', $lead['appointment'] ?? '')
        . truchat_email_row('Trade-in', $lead['tradeInDetails'] ?? '')
        . truchat_email_row('Finance', !empty($lead['financeInterest']) ? 'Interested' : '')
        . '</table>';
    if (!empty($lead['summary'])) {
        $inner .= '<p style="font:600 13px system-ui;color:#64748b;margin:18px 0 6px">Conversation summary</p>'
            . '<p style="font:400 13px/1.5 system-ui;color:#334155;margin:0;white-space:pre-wrap">' . esc_html($lead['summary']) . '</p>';
    }
    if ($wa) {
        $inner .= '<p style="margin:20px 0 0"><a href="https://wa.me/' . esc_attr($wa) . '" style="display:inline-block;background:#059669;color:#fff;font:700 13px system-ui;text-decoration:none;padding:11px 18px;border-radius:10px">Reply on WhatsApp</a></p>';
    }
    return truchat_email_shell('New chatbot lead', $inner);
}

function truchat_customer_email_html($lead) {
    $address = truchat_opt('address', '17 Burt Drive, Newton Park, Port Elizabeth');
    $wa = truchat_opt('sales_whatsapp', '27834659921');
    $wa_display = '+' . $wa;
    if (!empty($lead['appointment'])) {
        $booked = '<p style="font:400 14px/1.6 system-ui;color:#334155;margin:0 0 14px">We\'ve booked you in for <b>' . esc_html($lead['appointment']) . '</b> at our showroom. A member of the team will confirm the details.</p>';
    } else {
        $phone = !empty($lead['phone']) ? ' on <b>' . esc_html($lead['phone']) . '</b>' : '';
        $booked = '<p style="font:400 14px/1.6 system-ui;color:#334155;margin:0 0 14px">Thanks for reaching out — one of the team will follow up shortly' . $phone . '.</p>';
    }
    $inner = '<p style="font:600 16px system-ui;color:#0f172a;margin:0 0 12px">Hi ' . esc_html($lead['name'] ?: 'there') . ', thanks for chatting with Ray 👋</p>'
        . $booked;
    if (!empty($lead['vehicleInterest'])) {
        $inner .= '<p style="font:400 14px/1.6 system-ui;color:#334155;margin:0 0 14px">Vehicle of interest: <b>' . esc_html($lead['vehicleInterest']) . '</b></p>';
    }
    $inner .= '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e2e8f0;border-radius:10px;margin:6px 0 4px">'
        . truchat_email_row('Where', $address)
        . truchat_email_row('Hours', 'Mon–Fri 07:30–17:30 · Sat 07:30–13:00')
        . truchat_email_row('WhatsApp', $wa_display)
        . '</table>'
        . '<p style="font:400 13px/1.6 system-ui;color:#64748b;margin:16px 0 0">See you soon,<br><b>The ' . esc_html(truchat_opt('dealer_name', 'Your Car Guy')) . ' team</b></p>';
    return truchat_email_shell('Confirmation', $inner);
}

function truchat_mail_headers() {
    $from_name  = truchat_opt('dealer_name', 'Your Car Guy');
    $from_email = truchat_opt('from_email', get_option('admin_email'));
    $headers = array('Content-Type: text/html; charset=UTF-8');
    if ($from_email) $headers[] = 'From: ' . $from_name . ' <' . $from_email . '>';
    return $headers;
}

/**
 * Send dealer + customer emails. Returns array('dealer'=>bool,'customer'=>bool,'skipped'=>bool).
 */
function truchat_send_lead_emails($session, $summary) {
    $out = array('dealer' => false, 'customer' => false, 'skipped' => false);
    $lead = array_merge($session, array('summary' => $summary));
    $headers = truchat_mail_headers();

    // Dealer alert
    $dealer_email = truchat_opt('dealer_email', get_option('admin_email'));
    if ($dealer_email) {
        $subject = 'New lead: ' . ($lead['name'] ?: 'Website visitor')
            . (!empty($lead['appointment']) ? ' — ' . $lead['appointment'] : '');
        $out['dealer'] = (bool) wp_mail($dealer_email, $subject, truchat_dealer_email_html($lead), $headers);
    }

    // Customer confirmation
    if (!empty($lead['email']) && is_email($lead['email'])) {
        $subject = !empty($lead['appointment']) ? "You're booked in — " . truchat_opt('dealer_name', 'Your Car Guy')
            : 'Thanks from ' . truchat_opt('dealer_name', 'Your Car Guy');
        $out['customer'] = (bool) wp_mail($lead['email'], $subject, truchat_customer_email_html($lead), $headers);
    }

    if (!$out['dealer'] && !$out['customer']) $out['skipped'] = true;
    return $out;
}
