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
    $existing = get_option(TRUCHAT_OPT, array());
    $out = $existing; // Preserve existing keys not in the form.
    $text_keys = array('api_key', 'model', 'dealer_name', 'address', 'website', 'hours',
        'sales_whatsapp', 'brand_color', 'from_email', 'dealer_email', 'stock_api',
        'stock_api_fallback', 'enabled', 'greeting', 'portal_pin', 'logo_url', 'brand_line',
        'behind_proxy', 'daily_api_cap', 'skin', 'gemini_key', 'gemini_model',
        'wa_side', 'wa_bottom', 'ai_side', 'ai_bottom',
        'dealer_alert_channel', 'callmebot_phone', 'callmebot_apikey', 'repay_target');
    foreach ($text_keys as $k) {
        if (isset($input[$k])) $out[$k] = sanitize_text_field($input[$k]);
    }
    // Multiline fields — keep newlines.
    foreach (array('knowledge', 'hours', 'greeting', 'local_context') as $k) {
        if (isset($input[$k])) $out[$k] = sanitize_textarea_field($input[$k]);
    }
    // Checkboxes: unchecked posts nothing → store '0' explicitly.
    $out['enabled']     = !empty($input['enabled']) ? '1' : '0';
    $out['white_label'] = !empty($input['white_label']) ? '1' : '0';
    if (isset($input['logo_url'])) $out['logo_url'] = esc_url_raw($input['logo_url']);

    // Widget checkboxes — build enabled_widgets comma list.
    $widget_map = array('w_afford' => 'afford', 'w_repay' => 'repay', 'w_form' => 'form', 'w_book' => 'book', 'w_share' => 'share');
    $enabled_w = array();
    foreach ($widget_map as $key => $slug) {
        $out[$key] = !empty($input[$key]) ? '1' : '0';
        if ($out[$key] === '1') $enabled_w[] = $slug;
    }
    $out['enabled_widgets'] = implode(',', $enabled_w);

    // Per-widget position settings.
    $pos_keys = array(
        'afford_mode', 'afford_side', 'afford_bottom', 'afford_target',
        'repay_mode', 'repay_side', 'repay_bottom',
        'form_mode',  'form_side',  'form_bottom',  'form_target',
        'book_mode',  'book_side',  'book_bottom',  'book_target',
    );
    foreach ($pos_keys as $k) {
        if (isset($input[$k])) $out[$k] = sanitize_text_field($input[$k]);
    }

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
                truchat_field('api_key', 'Claude API key', 'password', 'sk-ant-...', 'Get one at <a href="https://console.anthropic.com" target="_blank">console.anthropic.com</a>. Keep it secret. <strong>Optional to start:</strong> leave this blank and the chat still runs in <em>offline mode</em> — a built-in keyword assistant that greets, answers common questions, qualifies the lead and hands off to WhatsApp, at zero cost. Add a key later and the same widget upgrades itself to the full Claude AI automatically.');
                truchat_field('gemini_key', 'Gemini API key (backup)', 'password', 'AIza...', 'Optional <strong>backup brain</strong>. If Claude has no key, no credit, or errors, Ray falls back to Gemini so the chat keeps working. Get one at <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a> (generous free tier). Backup replies are text-only — stock cards and slot booking stay with Claude.');
                truchat_field('gemini_model', 'Gemini model', 'text', 'gemini-2.0-flash', 'Default <code>gemini-2.0-flash</code> — fast and free-tier friendly.');
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
                <?php $skin = truchat_opt('skin', 'default'); ?>
                <tr>
                    <th scope="row"><label for="tc_skin">Widget style</label></th>
                    <td>
                        <select id="tc_skin" name="<?php echo TRUCHAT_OPT; ?>[skin]">
                            <option value="default" <?php selected($skin, 'default'); ?>>Premium (dealer colours) — one icon</option>
                            <option value="whatsapp" <?php selected($skin, 'whatsapp'); ?>>WhatsApp look — one icon</option>
                            <option value="both" <?php selected($skin, 'both'); ?>>Two icons — WhatsApp (left) + AI Ray (right)</option>
                        </select>
                        <p class="description">
                            <strong>Premium</strong> uses your brand colour below. <strong>WhatsApp look</strong> skins the whole
                            chat like WhatsApp — green header, chat bubbles and send button — so visitors instantly trust and
                            recognise it. <strong>Two icons</strong> shows both at once: a WhatsApp-styled bubble bottom-left and
                            the premium AI &ldquo;Ray&rdquo; bubble bottom-right — two front doors, one brain.
                            All options run the same Ray brain and hand a qualified lead to your personal WhatsApp
                            (<code><?php echo esc_html(truchat_opt('sales_whatsapp', '27834659921')); ?></code>). No Meta/WhatsApp
                            Business account is needed — it&rsquo;s a website chat that <em>looks</em> like WhatsApp.
                        </p>
                    </td>
                </tr>

                <?php
                // Only relevant in 'both' mode — two bubbles that may need to
                // dodge another corner widget (e.g. Seriti's finance button).
                $wa_side   = truchat_opt('wa_side', 'left');
                $wa_bottom = truchat_opt('wa_bottom', '150');
                $ai_side   = truchat_opt('ai_side', 'right');
                $ai_bottom = truchat_opt('ai_bottom', '24');
                ?>
                <tr>
                    <th scope="row">Bubble positions <span style="font-weight:400;color:#787c82">(&ldquo;Two icons&rdquo; mode)</span></th>
                    <td>
                        <p style="margin:0 0 8px">
                            <strong>WhatsApp bubble</strong> &mdash;
                            <select name="<?php echo TRUCHAT_OPT; ?>[wa_side]">
                                <option value="left"  <?php selected($wa_side, 'left'); ?>>bottom-left</option>
                                <option value="right" <?php selected($wa_side, 'right'); ?>>bottom-right</option>
                            </select>
                            &nbsp;raised
                            <input type="number" min="0" max="600" style="width:80px"
                                   name="<?php echo TRUCHAT_OPT; ?>[wa_bottom]"
                                   value="<?php echo esc_attr($wa_bottom); ?>" /> px from the bottom
                        </p>
                        <p style="margin:0 0 8px">
                            <strong>Ray (AI) bubble</strong> &mdash;
                            <select name="<?php echo TRUCHAT_OPT; ?>[ai_side]">
                                <option value="right" <?php selected($ai_side, 'right'); ?>>bottom-right</option>
                                <option value="left"  <?php selected($ai_side, 'left'); ?>>bottom-left</option>
                            </select>
                            &nbsp;raised
                            <input type="number" min="0" max="600" style="width:80px"
                                   name="<?php echo TRUCHAT_OPT; ?>[ai_bottom]"
                                   value="<?php echo esc_attr($ai_bottom); ?>" /> px from the bottom
                        </p>
                        <p class="description">
                            Move a bubble clear of anything else in that corner. If Seriti&rsquo;s finance button
                            sits bottom-left, either raise the WhatsApp bubble above it (bigger number), or set
                            <em>both</em> bubbles to <strong>bottom-right</strong> and stack them &mdash; Ray at
                            <code>24</code>, WhatsApp at about <code>100</code>. After saving, purge any
                            minify/optimisation cache and hard-refresh (Ctrl+Shift+R).
                        </p>
                    </td>
                </tr>

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

            <h2 class="title">Lead alerts</h2>
            <table class="form-table" role="presentation">
                <?php $chan = truchat_opt('dealer_alert_channel', 'email'); ?>
                <tr>
                    <th scope="row"><label for="tc_dealer_alert_channel">Alert the yard by</label></th>
                    <td>
                        <select id="tc_dealer_alert_channel" name="<?php echo TRUCHAT_OPT; ?>[dealer_alert_channel]">
                            <option value="email"    <?php selected($chan, 'email'); ?>>Email only</option>
                            <option value="whatsapp" <?php selected($chan, 'whatsapp'); ?>>WhatsApp only</option>
                            <option value="both"     <?php selected($chan, 'both'); ?>>Both email &amp; WhatsApp</option>
                        </select>
                        <p class="description">How the yard is notified of a new lead. The customer always gets an email confirmation, and every lead is saved to the leads list regardless.</p>
                    </td>
                </tr>
                <?php
                truchat_field('from_email', 'Send from', 'text', get_option('admin_email'), 'The "From" address on confirmation emails. Use an address on your domain and an SMTP plugin for reliable delivery.');
                truchat_field('dealer_email', 'Email alerts to', 'text', get_option('admin_email'), 'Where new-lead email alerts land.');
                ?>
            </table>

            <h2 class="title">WhatsApp alerts (free — no Meta account)</h2>
            <table class="form-table" role="presentation">
                <tr><td colspan="2" style="padding-left:0">
                    <p class="description" style="max-width:640px">
                        Sends the yard a WhatsApp the moment a lead lands, using the free
                        <a href="https://www.callmebot.com/blog/free-api-whatsapp-messages/" target="_blank">CallMeBot</a>
                        relay. <b>One-time setup on the phone that should receive alerts:</b>
                        (1) save the number <b>+34 644 51 95 23</b> to contacts;
                        (2) send it this WhatsApp message: <code>I allow callmebot to send me messages</code>;
                        (3) you'll get an <b>apikey</b> back — paste it below with that phone's number.
                        (Alerts go to your own number only — messaging customers needs the paid WhatsApp Business API.)
                    </p>
                </td></tr>
                <?php
                truchat_field('callmebot_phone', 'Yard WhatsApp number', 'text', '27834659921', 'The number that receives the alerts — country code, digits only (e.g. 27834659921).');
                truchat_field('callmebot_apikey', 'CallMeBot API key', 'text', '', 'The apikey CallMeBot sent back after step 2.');
                ?>
            </table>

            <h2 class="title">Widgets (calculators, forms, bookings)</h2>
            <table class="form-table" role="presentation">
                <?php
                $widgets = truwidgets_enabled();
                $w_defs = array(
                    'afford' => array(
                        'label' => 'TruAfford — Affordability calculator (soft pre-qual)',
                        'modes' => array('float' => 'Floating button', 'inline' => 'Inline on page'),
                    ),
                    'repay' => array(
                        'label' => 'TruRepay — Finance repayment calculator',
                        'modes' => array('inline' => 'Inline (full-width footer recommended)', 'float' => 'Floating button'),
                        'no_target' => true,
                    ),
                    'form' => array(
                        'label' => 'TruForm — Contact / enquiry form',
                        'modes' => array('float' => 'Floating button', 'inline' => 'Inline on page'),
                    ),
                    'book' => array(
                        'label' => 'TruBook — Test drive &amp; showroom bookings',
                        'modes' => array(),
                        'info' => 'Full-screen modal overlay — opens from other widgets or page links. No floating button.',
                    ),
                    'share' => array(
                        'label' => 'TruShare — Per-vehicle social sharing',
                        'modes' => array(),
                        'info' => 'Adds share buttons to vehicle listings. No position controls.',
                    ),
                );
                foreach ($w_defs as $slug => $def): ?>
                <tr><th scope="row"><?php echo wp_kses_post($def['label']); ?></th><td>
                    <label style="display:block;margin:4px 0"><input type="checkbox" name="<?php echo TRUCHAT_OPT; ?>[w_<?php echo $slug; ?>]" value="1" <?php checked(in_array($slug, $widgets)); ?> /> Enable</label>
                    <?php if (!empty($def['modes'])): ?>
                    <table class="form-table" style="margin:8px 0 0;border-collapse:collapse">
                        <tr>
                            <td style="padding:4px 12px 4px 0;border:none;white-space:nowrap"><label style="font-size:11px;color:#555;text-transform:none;letter-spacing:0;font-weight:600">Mode</label></td>
                            <td style="padding:4px 0;border:none">
                                <select name="<?php echo TRUCHAT_OPT; ?>[<?php echo $slug; ?>_mode]" style="font-size:12px">
                                    <?php
                                    $cur_mode = truchat_opt($slug . '_mode', $slug === 'repay' ? 'inline' : 'float');
                                    foreach ($def['modes'] as $val => $lbl):
                                        ?>
                                        <option value="<?php echo esc_attr($val); ?>" <?php selected($cur_mode, $val); ?>><?php echo esc_html($lbl); ?></option>
                                    <?php endforeach; ?>
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:4px 12px 4px 0;border:none;white-space:nowrap"><label style="font-size:11px;color:#555;text-transform:none;letter-spacing:0;font-weight:600">Side</label></td>
                            <td style="padding:4px 0;border:none">
                                <select name="<?php echo TRUCHAT_OPT; ?>[<?php echo $slug; ?>_side]" style="font-size:12px">
                                    <?php
                                    $cur_side = truchat_opt($slug . '_side', 'right');
                                    ?>
                                    <option value="right" <?php selected($cur_side, 'right'); ?>>Right</option>
                                    <option value="left" <?php selected($cur_side, 'left'); ?>>Left</option>
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:4px 12px 4px 0;border:none;white-space:nowrap"><label style="font-size:11px;color:#555;text-transform:none;letter-spacing:0;font-weight:600">Bottom offset</label></td>
                            <td style="padding:4px 0;border:none">
                                <input type="number" min="0" max="600" style="width:80px;font-size:12px"
                                       name="<?php echo TRUCHAT_OPT; ?>[<?php echo $slug; ?>_bottom]"
                                       value="<?php echo esc_attr(truchat_opt($slug . '_bottom', $slug === 'afford' ? '88' : '24')); ?>" /> px
                                <span style="font-size:11px;color:#888">from the bottom edge</span>
                            </td>
                        </tr>
                        <?php if (empty($def['no_target'])): ?>
                        <tr>
                            <td style="padding:4px 12px 4px 0;border:none;white-space:nowrap"><label style="font-size:11px;color:#555;text-transform:none;letter-spacing:0;font-weight:600">Inline target</label></td>
                            <td style="padding:4px 0;border:none">
                                <input type="text" style="width:200px;font-size:12px"
                                       name="<?php echo TRUCHAT_OPT; ?>[<?php echo $slug; ?>_target]"
                                       value="<?php echo esc_attr(truchat_opt($slug . '_target', '')); ?>"
                                       placeholder="<?php echo $slug === 'form' ? '#contact-form' : '#' . $slug . '-slot'; ?>" />
                                <span style="font-size:11px;color:#888">CSS selector — widget renders inside this element when mode is "inline"</span>
                            </td>
                        </tr>
                        <?php endif; ?>
                    </table>
                    <?php endif; ?>
                    <?php if (!empty($def['info'])): ?>
                    <p class="description" style="margin:4px 0 0"><?php echo esc_html($def['info']); ?></p>
                    <?php endif; ?>
                </td></tr>
                <?php endforeach; ?>
                <?php
                truchat_field('repay_target', 'TruRepay inline target', 'text', '#finance-calc', 'CSS selector for the inline finance calculator. Add <code>&lt;div id="finance-calc"&gt;&lt;/div&gt;</code> where you want it on the page. Leave as <code>#finance-calc</code> — the widget positions itself full-width at that spot.');
                ?>
            </table>

            <h2 class="title">Leads portal</h2>
            <table class="form-table" role="presentation">
                <tr><th scope="row">In WordPress</th><td>
                    <a href="<?php echo esc_url(admin_url('options-general.php?page=truchat-leads')); ?>">Open TruChat Leads &rarr;</a>
                    <p class="description">All captured leads, viewable here in the admin.</p>
                </td></tr>
                <tr><th scope="row">PWA Portal (installable)</th><td>
                    <?php $portal_url = home_url('/' . TRUDEALER_PORTAL_SLUG . '/'); ?>
                    <a href="<?php echo esc_url($portal_url); ?>" target="_blank"><?php echo esc_html($portal_url); ?></a>
                    <p class="description">Open this on your phone and tap <strong>Add to Home Screen</strong> to install. You'll get instant push notifications when new leads arrive. PIN-protected — set a PIN below.</p>
                </td></tr>
                <?php
                truchat_field('portal_pin', 'Portal PIN', 'text', '', 'Set a PIN to protect the standalone portal and PWA. Leave blank to disable portal access. Endpoint: <code>' . esc_html(rest_url('truchat/v1/leads')) . '</code>');
                truchat_field('daily_api_cap', 'Daily AI message cap', 'text', '500', 'Hard ceiling on paid API calls per day across all visitors — protects you from a scraper or a bad week running up the bill. The chatbot still answers from its knowledge base and offers WhatsApp once the cap is reached. <code>0</code> removes the ceiling.');
                truchat_field('behind_proxy', 'Site is behind Cloudflare / a proxy', 'text', '', 'Enter <code>1</code> only if this site really sits behind Cloudflare or another reverse proxy. It tells the rate limiter to read the forwarded-IP header. Leave blank otherwise — visitors can set that header themselves, which would let them slip the rate limit.');
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
                    'This is Ray\'s brain — your dealership\'s facts. Leave blank to use the built-in default. Anything you type here REPLACES it. Replace every <code>[EDIT]</code> with real facts. Ray only knows what is written here — don\'t claim things you can\'t back up.');
                truchat_field('local_context', 'Local context (slang & terms)', 'textarea',
                    truchat_default_local_context(),
                    'Regional lingo, vehicle slang and buyer terms — added on top of the knowledge above and kept separate so it survives when you rewrite the knowledge base. Ships with South African / bakkie defaults; edit for your area or another dealer. Leave blank to use the built-in default.');
                ?>
            </table>

            <?php submit_button('Save TruChat settings'); ?>
        </form>
    </div>
    <?php
}
