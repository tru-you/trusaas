<?php
/**
 * TruWidgets — admin settings page (Settings → TruWidgets).
 * One editable rig: everything the injector needs is configured here.
 */

if (!defined('ABSPATH')) exit;

add_action('admin_menu', function () {
    add_options_page('TruWidgets', 'TruWidgets', 'manage_options', 'truwidgets', 'truw_settings_page');
});

add_action('admin_init', function () {
    register_setting('truw_group', TRUW_OPT, 'truw_sanitize');
});

// WordPress' native colour picker on our settings page — gives a visual swatch
// + wheel so you can see the colour you're choosing.
add_action('admin_enqueue_scripts', function ($hook) {
    if ($hook !== 'settings_page_truwidgets') return;
    wp_enqueue_style('wp-color-picker');
    wp_enqueue_script('wp-color-picker');
    wp_add_inline_script('wp-color-picker', 'jQuery(function($){$(".truw-color").wpColorPicker();});');
});

/** Whitelist + light sanitising. */
function truw_sanitize($input) {
    $out = array();
    if (!is_array($input)) return $out;

    $text   = array('dealer_name', 'accent2', 'text_color', 'scale', 'theme', 'sales_whatsapp',
                    'afford_side', 'repay_side', 'form_side',
                    'afford_bottom', 'repay_bottom', 'form_bottom',
                    'afford_scale', 'repay_scale', 'form_scale',
                    'repay_mode', 'repay_target',
                    'repay_vehicle', 'book_address', 'share_vehicle_path',
                    // per-page targeting: <widget>_show (mode) + <widget>_match (path/ids)
                    'afford_show', 'repay_show', 'form_show', 'book_show', 'share_show',
                    'afford_match', 'repay_match', 'form_match', 'book_match', 'share_match');
    $checks = array('use_text', 'w_afford', 'w_repay', 'w_form', 'w_book', 'w_share');

    foreach ($text as $k)  { if (isset($input[$k])) $out[$k] = sanitize_text_field($input[$k]); }
    foreach ($checks as $k) { $out[$k] = (!empty($input[$k])) ? '1' : ''; }

    $out['brand_color']    = isset($input['brand_color']) ? sanitize_hex_color($input['brand_color']) : '#1466E0';
    $out['repay_price']    = isset($input['repay_price']) ? preg_replace('/[^\d.]/', '', $input['repay_price']) : '';
    $out['callmebot_key']  = isset($input['callmebot_key']) ? sanitize_text_field($input['callmebot_key']) : '';
    $out['callmebot_phone']= isset($input['callmebot_phone']) ? preg_replace('/\D/', '', $input['callmebot_phone']) : '';
    $out['webhook']        = isset($input['webhook']) ? esc_url_raw(trim($input['webhook'])) : '';
    $out['share_site']     = isset($input['share_site']) ? esc_url_raw(trim($input['share_site'])) : '';
    $out['cdn_base']       = isset($input['cdn_base']) ? esc_url_raw(trim($input['cdn_base'])) : '';
    return $out;
}

/** Render one field row. */
function truw_field($key, $label, $type = 'text', $opts = array()) {
    $name = TRUW_OPT . '[' . $key . ']';
    $val  = truw_opt($key, isset($opts['default']) ? $opts['default'] : '');
    $ph   = isset($opts['placeholder']) ? $opts['placeholder'] : '';
    $help = isset($opts['help']) ? $opts['help'] : '';
    echo '<tr><th scope="row"><label for="' . esc_attr($key) . '">' . esc_html($label) . '</label></th><td>';
    if ($type === 'select') {
        echo '<select id="' . esc_attr($key) . '" name="' . esc_attr($name) . '">';
        foreach ($opts['options'] as $o) {
            echo '<option value="' . esc_attr($o) . '"' . selected($val, $o, false) . '>' . esc_html($o) . '</option>';
        }
        echo '</select>';
    } elseif ($type === 'checkbox') {
        echo '<label><input type="checkbox" name="' . esc_attr($name) . '" value="1"' . checked($val, '1', false) . '> ' . esc_html($opts['cblabel'] ?? '') . '</label>';
    } elseif ($type === 'color') {
        echo '<input type="text" class="truw-color" id="' . esc_attr($key) . '" name="' . esc_attr($name) . '" value="' . esc_attr($val) . '" data-default-color="' . esc_attr($val ? $val : '#1466E0') . '" placeholder="#1466E0" />';
    } else {
        $w = ($type === 'url') ? 'width:100%;max-width:520px' : 'width:320px';
        echo '<input type="text" id="' . esc_attr($key) . '" name="' . esc_attr($name) . '" value="' . esc_attr($val) . '" placeholder="' . esc_attr($ph) . '" style="' . $w . '" />';
    }
    if ($help) echo '<p class="description">' . wp_kses_post($help) . '</p>';
    echo '</td></tr>';
}

function truw_settings_page() {
    if (!current_user_can('manage_options')) return; ?>
    <div class="wrap">
        <h1>TruWidgets</h1>
        <?php
        /* Loud guard: a lead widget is on but there's nowhere for a lead to go.
           A CallMeBot key with no phone number does NOT count (its ping aborts). */
        $wa_set  = preg_replace('/\D/', '', truw_opt('sales_whatsapp', '')) !== '';
        $hook    = truw_opt('webhook') !== '';
        $cmb_ok  = truw_opt('callmebot_key') && (preg_replace('/\D/', '', truw_opt('callmebot_phone', '')) !== '' || $wa_set);
        $lead_widget_on = truw_opt('w_afford') === '1' || truw_opt('w_repay') === '1' ||
                          truw_opt('w_form') === '1' || truw_opt('w_book') === '1';
        if ($lead_widget_on && !$wa_set && !$hook && !$cmb_ok) {
            echo '<div class="notice notice-error"><p><strong>Leads have nowhere to go.</strong> '
               . 'A lead widget is enabled but no destination is set — submissions will silently do nothing. '
               . 'Fix at least one: set <strong>Sales WhatsApp</strong>, a <strong>Webhook URL</strong>, or a '
               . '<strong>CallMeBot key <em>and</em> phone</strong> below.</p></div>';
        } elseif ($lead_widget_on && truw_opt('callmebot_key') && !$cmb_ok) {
            echo '<div class="notice notice-warning"><p><strong>CallMeBot has a key but no phone.</strong> '
               . 'Set <strong>CallMeBot phone</strong> (or a <strong>Sales WhatsApp</strong> number, which it falls back to) or the ping is skipped.</p></div>';
        }
        ?>
        <p>Drop-in dealer widgets, driven entirely from this page. Enable the ones you want, brand them, and set where leads go. The widget code loads from the TruSaaS CDN.</p>
        <form method="post" action="options.php">
            <?php settings_fields('truw_group'); ?>

            <h2 class="title">Brand</h2>
            <table class="form-table"><tbody>
                <?php
                truw_field('dealer_name', 'Dealer name', 'text', array('placeholder' => get_bloginfo('name')));
                truw_field('brand_color', 'Brand colour', 'color', array('default' => '#1466E0'));
                truw_field('accent2', 'Accent 2 (gradient end)', 'color', array('help' => 'Optional.'));
                truw_field('use_text', 'Custom text colour', 'checkbox', array('cblabel' => 'Override the default text colour'));
                truw_field('text_color', '↳ Text colour', 'color', array('help' => 'Used only when the box above is ticked.'));
                truw_field('scale', 'Widget size (height &amp; width)', 'select', array('options' => array('0.8', '0.9', '1', '1.1', '1.2', '1.3', '1.4', '1.5', '1.6'), 'default' => '1', 'help' => 'Scales the launcher up or down — bigger number = taller &amp; wider. 1 = default. Applies to TruAfford, TruRepay and TruForm launchers.'));
                truw_field('theme', 'Theme', 'select', array('options' => array('dark', 'light'), 'default' => 'dark'));
                truw_field('sales_whatsapp', 'Sales WhatsApp', 'text', array('placeholder' => '27834659921', 'help' => 'Digits only, country code, no +.'));
                ?>
            </tbody></table>

            <h2 class="title">Widgets</h2>
            <table class="form-table"><tbody>
                <?php
                truw_field('w_afford', 'TruAfford', 'checkbox', array('cblabel' => 'Affordability estimate (floating launcher)'));
                truw_field('w_repay', 'TruRepay', 'checkbox', array('cblabel' => 'Finance calculator (float or inline)'));
                truw_field('w_form', 'TruForm', 'checkbox', array('cblabel' => 'Enquiry capture (floating launcher)'));
                truw_field('w_book', 'TruBook', 'checkbox', array('cblabel' => 'Test-drive booking (needs a trigger button — see help below)'));
                truw_field('w_share', 'TruShare', 'checkbox', array('cblabel' => 'Per-vehicle share (needs a trigger button per car)'));
                ?>
                <tr><td colspan="2"><p class="description">TruForm mounts its own launcher. <strong>TruBook</strong> opens via <code>TruDealer.open('book')</code> and <strong>TruShare</strong> via <code>TruShare.open({…})</code> — add those buttons to your pages/vehicle template.</p></td></tr>
            </tbody></table>

            <h2 class="title">Placement</h2>
            <table class="form-table"><tbody>
                <?php
                $sizes = array('0.7', '0.75', '0.8', '0.85', '0.9', '0.95', '1', '1.1', '1.2', '1.3');
                truw_field('afford_side', 'TruAfford side', 'select', array('options' => array('left', 'right'), 'default' => 'left'));
                truw_field('afford_bottom', '↳ Height from bottom', 'text', array('placeholder' => '116 (px)', 'help' => 'How far up the launcher sits from the bottom edge. Blank = default (116px, so it clears a lower FAB).'));
                truw_field('afford_scale', '↳ Size', 'select', array('options' => $sizes, 'default' => '1', 'help' => 'Shrink or grow just this launcher. TruAfford carries more text, so 0.8–0.85 makes it match TruForm.'));
                truw_field('repay_side', 'TruRepay side', 'select', array('options' => array('left', 'right'), 'default' => 'left'));
                truw_field('repay_bottom', '↳ Height from bottom', 'text', array('placeholder' => '24 (px)', 'help' => 'Blank = default (24px).'));
                truw_field('repay_scale', '↳ Size', 'select', array('options' => $sizes, 'default' => '1'));
                truw_field('form_side', 'TruForm side', 'select', array('options' => array('right', 'left'), 'default' => 'right'));
                truw_field('form_bottom', '↳ Height from bottom', 'text', array('placeholder' => '24 (px)', 'help' => 'Blank = default (24px). Raise it to clear a chat bubble or WhatsApp button.'));
                truw_field('form_scale', '↳ Size', 'select', array('options' => $sizes, 'default' => '1'));
                ?>
            </tbody></table>

            <h2 class="title">Where they show</h2>
            <p class="description" style="max-width:640px">Choose which pages each widget appears on. <strong>Everywhere</strong> = whole site · <strong>Home only</strong> = front page · <strong>Single pages/posts</strong> = any single item · <strong>URL contains…</strong> = pages whose path includes the text you enter (e.g. <code>/vehicle</code> for stock pages) · <strong>Specific IDs…</strong> = a comma-separated list of page/post IDs.</p>
            <table class="form-table"><tbody>
                <?php
                $show_opts = array('everywhere', 'home', 'singular', 'path', 'ids');
                foreach (array('afford' => 'TruAfford', 'repay' => 'TruRepay', 'form' => 'TruForm', 'book' => 'TruBook', 'share' => 'TruShare') as $wk => $wl) {
                    truw_field($wk . '_show', $wl . ' — show on', 'select', array('options' => $show_opts, 'default' => 'everywhere'));
                    truw_field($wk . '_match', '↳ URL contains / IDs', 'text', array('placeholder' => '/vehicle   or   12, 48, 91', 'help' => 'Used only for "path" or "ids" above.'));
                }
                ?>
            </tbody></table>

            <h2 class="title">Lead delivery</h2>
            <table class="form-table"><tbody>
                <?php
                truw_field('webhook', 'Webhook URL', 'url', array('placeholder' => 'https://hooks.zapier.com/…', 'help' => 'Zapier/Make/CRM endpoint. Leads POST here as JSON.'));
                truw_field('callmebot_key', 'CallMeBot API key', 'text', array('help' => 'Instant WhatsApp ping. <a href="https://www.callmebot.com/blog/free-api-whatsapp-messages/" target="_blank">One-time setup</a>. Sends customer details via a third-party relay — use alongside a webhook, not instead of it.'));
                truw_field('callmebot_phone', 'CallMeBot phone', 'text', array('placeholder' => 'defaults to Sales WhatsApp', 'help' => 'The number that receives the alerts.'));
                ?>
            </tbody></table>

            <h2 class="title">Per-widget options</h2>
            <table class="form-table"><tbody>
                <?php
                truw_field('repay_mode', 'TruRepay mode', 'select', array('options' => array('float', 'inline'), 'default' => 'float'));
                truw_field('repay_target', '↳ Inline target', 'text', array('placeholder' => '#finance-calc', 'help' => 'Element selector when mode is inline.'));
                truw_field('repay_price', 'TruRepay default price', 'text', array('placeholder' => '459900'));
                truw_field('repay_vehicle', 'TruRepay default vehicle', 'text', array('placeholder' => '2023 Toyota Fortuner'));
                truw_field('book_address', 'TruBook address', 'text', array('placeholder' => 'Port Elizabeth'));
                truw_field('share_site', 'TruShare site origin', 'text', array('placeholder' => home_url('/')));
                truw_field('share_vehicle_path', 'TruShare vehicle path', 'text', array('placeholder' => '/vehicle/'));
                ?>
            </tbody></table>

            <h2 class="title">Advanced</h2>
            <table class="form-table"><tbody>
                <?php
                truw_field('cdn_base', 'Widget CDN base', 'url', array('placeholder' => 'https://cdn.tru-saas.com', 'help' => 'Where the widget files are hosted. Leave blank for the default TruSaaS CDN.'));
                ?>
            </tbody></table>

            <?php submit_button('Save TruWidgets'); ?>
        </form>
    </div>
    <?php
}
