<?php
/**
 * TruChat settings page — Settings > TruChat.
 * One screen: API key, model, contact details, emails, knowledge base.
 */

if (!defined('ABSPATH')) exit;

add_action('admin_menu', function () {
    add_options_page('TruChat (Ray)', 'TruChat', 'manage_options', 'truchat', 'truchat_settings_page');
});

// The logo picker uses the WordPress media library.
add_action('admin_enqueue_scripts', function ($hook) {
    if ($hook === 'settings_page_truchat') wp_enqueue_media();
});

add_action('admin_init', function () {
    register_setting('truchat_group', TRUCHAT_OPT, 'truchat_sanitize');
});

function truchat_sanitize($input) {
    $out = array();
    $text_keys = array('api_key', 'model', 'dealer_name', 'address', 'website', 'hours',
        'sales_whatsapp', 'brand_color', 'from_email', 'dealer_email', 'stock_api',
        'stock_api_fallback', 'enabled', 'greeting', 'portal_pin', 'logo_url', 'brand_line',
        'behind_proxy', 'daily_api_cap');
    foreach ($text_keys as $k) {
        if (isset($input[$k])) $out[$k] = sanitize_text_field($input[$k]);
    }
    // Multiline fields — keep newlines.
    foreach (array('knowledge', 'hours', 'greeting') as $k) {
        if (isset($input[$k])) $out[$k] = sanitize_textarea_field($input[$k]);
    }
    // Checkboxes: unchecked posts nothing → store '0' explicitly.
    $out['enabled']     = !empty($input['enabled']) ? '1' : '0';
    $out['white_label'] = !empty($input['white_label']) ? '1' : '0';
    if (isset($input['logo_url'])) $out['logo_url'] = esc_url_raw($input['logo_url']);
    return $out;
}

function truchat_field($key, $label, $type = 'text', $placeholder = '', $help = '') {
    $val = truchat_opt($key, '');
    $name = TRUCHAT_OPT . '[' . $key . ']';
    echo '<tr><th scope="row"><label for="tc_' . esc_attr($key) . '">' . esc_html($label) . '</label></th><td>';
    if ($type === 'textarea') {
        echo '<textarea id="tc_' . esc_attr($key) . '" name="' . esc_attr($name) . '" rows="8" class="large-text code" placeholder="' . esc_attr($placeholder) . '">' . esc_textarea($val) . '</textarea>';
    } elseif ($type === 'password') {
        echo '<input type="password" id="tc_' . esc_attr($key) . '" name="' . esc_attr($name) . '" value="' . esc_attr($val) . '" class="regular-text" placeholder="' . esc_attr($placeholder) . '" autocomplete="off" />';
    } else {
        echo '<input type="text" id="tc_' . esc_attr($key) . '" name="' . esc_attr($name) . '" value="' . esc_attr($val) . '" class="regular-text" placeholder="' . esc_attr($placeholder) . '" />';
    }
    if ($help) echo '<p class="description">' . wp_kses_post($help) . '</p>';
    echo '</td></tr>';
}

function truchat_settings_page() {
    if (!current_user_can('manage_options')) return;
    $enabled = truchat_opt('enabled', '1');
    ?>
    <div class="wrap">
        <h1>TruChat — Ray (Your Car Guy)</h1>
        <p>The AI showroom assistant. The Claude API key stays on this server and is never exposed to the browser.</p>
        <form method="post" action="options.php">
            <?php settings_fields('truchat_group'); ?>

            <h2 class="title">AI</h2>
            <table class="form-table" role="presentation">
                <tr><th scope="row">Enabled</th><td>
                    <label><input type="checkbox" name="<?php echo TRUCHAT_OPT; ?>[enabled]" value="1" <?php checked($enabled, '1'); ?> /> Show the chat widget on the site</label>
                </td></tr>
                <?php
                truchat_field('api_key', 'Claude API key', 'password', 'sk-ant-...', 'Get one at <a href="https://console.anthropic.com" target="_blank">console.anthropic.com</a>. Keep it secret.');
                truchat_field('model', 'Model', 'text', 'claude-haiku-4-5', 'Hybrid mode: common questions are answered free from your knowledge base and never hit the API — the model is only used for novel questions. Default <code>claude-haiku-4-5</code> (cheapest, ~2–3c per conversation). Use <code>claude-sonnet-5</code> or <code>claude-opus-4-8</code> for higher quality on those fallback answers.');
                ?>
            </table>

            <h2 class="title">Dealership</h2>
            <table class="form-table" role="presentation">
                <?php
                truchat_field('dealer_name', 'Dealer name', 'text', 'Your Car Guy');
                truchat_field('address', 'Address', 'text', '17 Burt Drive, Newton Park, Port Elizabeth');
                truchat_field('website', 'Website', 'text', 'https://yourcarguy.co.za');
                truchat_field('hours', 'Working hours', 'textarea', "Mon–Fri: 07:30 – 17:30\nSaturday: 07:30 – 13:00\nSunday: By appointment only");
                truchat_field('sales_whatsapp', 'Sales WhatsApp', 'text', '27834659921', 'Digits only, country code, no +. Used for the WhatsApp handoff button.');
                truchat_field('greeting', 'Greeting', 'textarea', '', 'First message Ray shows. **bold** is supported.');
                ?>
            </table>

            <h2 class="title">Branding</h2>
            <table class="form-table" role="presentation">
                <?php $logo = truchat_logo_url(); ?>
                <tr>
                    <th scope="row"><label for="tc_logo_url">Chat icon / logo</label></th>
                    <td>
                        <img id="tc_logo_preview" src="<?php echo esc_url($logo); ?>" alt=""
                             style="width:64px;height:64px;object-fit:cover;border-radius:14px;background:#0a0b10;vertical-align:middle;border:1px solid #ccd0d4" />
                        <input type="hidden" id="tc_logo_url" name="<?php echo TRUCHAT_OPT; ?>[logo_url]" value="<?php echo esc_attr(truchat_opt('logo_url', '')); ?>" />
                        <button type="button" class="button" id="tc_logo_pick" style="margin-left:12px">Choose image</button>
                        <button type="button" class="button" id="tc_logo_reset">Use default</button>
                        <p class="description">Shown on the chat bubble, the chat header and the leads portal. Square images work best (at least 128&times;128).</p>
                    </td>
                </tr>
                <?php
                truchat_field('brand_color', 'Brand colour', 'text', '#e30613', 'Skins the chat widget, the emails and the portal.');
                truchat_field('brand_line', 'Footer line', 'text', 'Your Car Guy · Port Elizabeth', 'Small line at the bottom of the chat window.');
                ?>
                <tr><th scope="row">White label</th><td>
                    <label><input type="checkbox" name="<?php echo TRUCHAT_OPT; ?>[white_label]" value="1" <?php checked(truchat_opt('white_label', '0'), '1'); ?> />
                    Hide the &ldquo;TruChat by TruSaaS&rdquo; credit</label>
                    <p class="description">Removes the credit from the chat footer, the emails and the WhatsApp message, so it reads as the dealership&rsquo;s own system.</p>
                </td></tr>
            </table>
            <script>
            jQuery(function ($) {
                var frame, DEFAULT = <?php echo wp_json_encode(TRUCHAT_URL . 'assets/ycg-icon.jpg'); ?>;
                $('#tc_logo_pick').on('click', function (e) {
                    e.preventDefault();
                    if (frame) { frame.open(); return; }
                    frame = wp.media({ title: 'Choose chat icon', button: { text: 'Use this image' }, multiple: false });
                    frame.on('select', function () {
                        var a = frame.state().get('selection').first().toJSON();
                        $('#tc_logo_url').val(a.url);
                        $('#tc_logo_preview').attr('src', a.url);
                    });
                    frame.open();
                });
                $('#tc_logo_reset').on('click', function (e) {
                    e.preventDefault();
                    $('#tc_logo_url').val('');
                    $('#tc_logo_preview').attr('src', DEFAULT);
                });
            });
            </script>

            <h2 class="title">Email confirmations</h2>
            <table class="form-table" role="presentation">
                <?php
                truchat_field('from_email', 'Send from', 'text', get_option('admin_email'), 'The "From" address on confirmation emails. Use an address on your domain and an SMTP plugin for reliable delivery.');
                truchat_field('dealer_email', 'Dealer alerts to', 'text', get_option('admin_email'), 'Where new-lead alerts land.');
                ?>
            </table>

            <h2 class="title">Leads portal</h2>
            <table class="form-table" role="presentation">
                <tr><th scope="row">In WordPress</th><td>
                    <a href="<?php echo esc_url(admin_url('options-general.php?page=truchat-leads')); ?>">Open TruChat Leads &rarr;</a>
                    <p class="description">All captured leads, viewable here in the admin.</p>
                </td></tr>
                <?php
                truchat_field('daily_api_cap', 'Daily AI message cap', 'text', '500', 'Hard ceiling on paid API calls per day across all visitors — protects you from a scraper or a bad week running up the bill. The chatbot still answers from its knowledge base and offers WhatsApp once the cap is reached. <code>0</code> removes the ceiling.');
                truchat_field('behind_proxy', 'Site is behind Cloudflare / a proxy', 'text', '', 'Enter <code>1</code> only if this site really sits behind Cloudflare or another reverse proxy. It tells the rate limiter to read the forwarded-IP header. Leave blank otherwise — visitors can set that header themselves, which would let them slip the rate limit.');
                truchat_field('portal_pin', 'Standalone portal PIN', 'text', '', 'Set a PIN to enable the mobile-friendly <code>portal.html</code> (open it on any device, no WordPress login). Leave blank to disable it. Endpoint: <code>' . esc_html(rest_url('truchat/v1/leads')) . '</code>');
                ?>
            </table>

            <h2 class="title">Live stock feed (optional)</h2>
            <table class="form-table" role="presentation">
                <?php
                truchat_field('stock_api', 'Stock API URL', 'text', 'https://premium.tru-saas.com/api/public/stock?dealer=your-car-guy', 'Returns JSON <code>{ "vehicles": [...] }</code>. Leave blank to rely on manual knowledge.');
                truchat_field('stock_api_fallback', 'Fallback stock API', 'text', '');
                ?>
            </table>

            <h2 class="title">Knowledge base</h2>
            <table class="form-table" role="presentation">
                <?php
                truchat_field('knowledge', 'What Ray knows', 'textarea',
                    truchat_default_knowledge(),
                    'This is Ray\'s brain. Leave blank to use the built-in default. Anything you type here REPLACES it. Replace every <code>[EDIT]</code> with real facts. Ray only knows what is written here — don\'t claim things you can\'t back up.');
                ?>
            </table>

            <?php submit_button('Save TruChat settings'); ?>
        </form>
    </div>
    <?php
}
