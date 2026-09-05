<?php
/**
 * TruChat brain (WordPress) — Claude tool-use loop.
 *
 * truchat_handle_chat($body) takes { messages, session, catalog } and returns
 * { reply, actions, session }. The API key never leaves the server.
 */

if (!defined('ABSPATH')) exit;

define('TRUCHAT_DEFAULT_MODEL', 'claude-haiku-4-5'); // hybrid: cheap fallback; knowledge answers most turns free
define('TRUCHAT_MAX_TURNS', 6);

/* ---- Knowledge-first FAQ layer (answers common questions with NO API call) ---
 *
 * Runs before the LLM. If the customer's message clearly maps to a common
 * question, we answer instantly from settings — free, zero latency. Anything
 * novel or transactional (booking, "show me a Ranger", giving contact details)
 * falls through to Claude, which drives the tools and full knowledge base.
 */

function truchat_faq_intents() {
    $hours   = truchat_opt('hours', "Mon–Fri: 07:30 – 17:30\nSaturday: 07:30 – 13:00\nSunday: By appointment only");
    $address = truchat_opt('address', '17 Burt Drive, Newton Park, Port Elizabeth');
    $wa      = truchat_opt('sales_whatsapp', '27834659921');
    $wa_disp = '+' . preg_replace('/\D/', '', $wa);
    $website = truchat_opt('website', 'https://yourcarguy.co.za');

    return array(
        array(
            'keys' => array('hi', 'hello', 'hey', 'howzit', 'hallo', 'good morning', 'good afternoon', 'good day', 'goeie'),
            'reply' => "Howzit! 👋 I'm **Ray** at **" . truchat_opt('dealer_name', 'Your Car Guy') . "**. I can help with **stock**, **finance**, **trade-ins**, **test drives** or **hours**. What are you after?",
            'suggestions' => array('Browse stock', 'Trade-in valuation', 'Book test drive', 'Finance help'),
        ),
        array(
            'keys' => array('thanks', 'thank you', 'thank u', 'cheers', 'dankie', 'appreciate', 'lekker', 'awesome'),
            'reply' => "Pleasure! 🙌 Anything else I can sort — stock, finance or a test drive?",
            'suggestions' => array('Browse stock', 'Finance help', 'Book test drive'),
        ),
        array(
            'keys' => array('hours', 'open', 'opening', 'closing', 'close', 'what time', 'trading hours', 'when are you', 'still open'),
            'reply' => "🕒 **Working hours**\n" . $hours,
            'suggestions' => array('Where are you?', 'Browse stock'),
        ),
        array(
            'keys' => array('where', 'address', 'located', 'location', 'directions', 'find you', 'how do i get', 'which area', 'suburb'),
            'reply' => "📍 We're at **" . $address . "**. Pop in during working hours, or I can book you a time.",
            'suggestions' => array('Working hours', 'Book test drive'),
        ),
        array(
            'keys' => array('whatsapp', 'phone number', 'contact', 'call you', 'number to call', 'get hold', 'telephone'),
            'reply' => "You can reach the yard on WhatsApp at **" . $wa_disp . "**, or tap the button below and I'll pass your details straight through.",
            'suggestions' => array(),
            'actions' => array(array('type' => 'whatsapp')),
        ),
        array(
            'keys' => array('finance', 'financ', 'instalment', 'installment', 'repayment', 'monthly', 'afford', 'credit', 'bank', 'deposit', 'interest rate'),
            'reply' => "We arrange **vehicle finance** through the major SA banks on our approved pre-owned stock. Share your **mobile number** and the finance desk will start a soft, no-obligation pre-assessment — no guaranteed rate until the bank confirms. Which vehicle are you looking at?",
            'suggestions' => array('Browse stock', 'Book test drive'),
        ),
        array(
            'keys' => array('trade in', 'trade-in', 'tradein', 'sell my car', 'sell my vehicle', 'valuation', 'value my', 'take my car'),
            'reply' => "We buy pre-owned daily. Send me the **year, make, model, mileage & condition** and whether it's still financed, and we'll give you a proper figure after a quick look at the yard.",
            'suggestions' => array('Book a valuation', 'Browse stock'),
        ),
        array(
            'keys' => array('warranty', 'guarantee', 'service history', 'service plan', 'roadworthy', 'condition of'),
            'reply' => "Good question — warranty and service history vary per vehicle. Tell me which car you're interested in and I'll get the yard to confirm exactly what it comes with.",
            'suggestions' => array('Browse stock'),
        ),
    );
}

/** Returns array(reply, actions, suggestions) or null if nothing matched. */
function truchat_faq_match($text) {
    $t = strtolower(trim((string) $text));
    if ($t === '') return null;

    // Don't short-circuit transactional messages — let the LLM drive tools.
    if (preg_match('/\d{7,}/', $t)) return null;          // looks like a phone number
    if (strpos($t, '@') !== false) return null;            // an email address
    if (preg_match('/\b(book|booking|test drive|come see|come in|view it|can i come|apply for)\b/', $t)) return null;
    if (str_word_count($t) > 16) return null;              // long/complex → LLM

    $best = null; $bestScore = 0;
    foreach (truchat_faq_intents() as $intent) {
        $score = 0;
        foreach ($intent['keys'] as $k) {
            if (strpos($t, $k) !== false) $score += (strpos($k, ' ') !== false ? 2 : 1);
        }
        if ($score > $bestScore) { $bestScore = $score; $best = $intent; }
    }
    if (!$best || $bestScore < 1) return null;

    return array(
        'reply'       => $best['reply'],
        'actions'     => isset($best['actions']) ? $best['actions'] : array(),
        'suggestions' => isset($best['suggestions']) ? $best['suggestions'] : array(),
    );
}

/* ---- Tool definitions --------------------------------------------------- */

function truchat_tools() {
    return array(
        array(
            'name' => 'search_stock',
            'description' => 'Search current dealership stock by make, model, body type, fuel or budget. Returns matching vehicles which the customer will see as cards.',
            'input_schema' => array(
                'type' => 'object',
                'properties' => array(
                    'query' => array('type' => 'string', 'description' => "What the customer is after, e.g. 'Ford Ranger diesel', 'bakkie under 300k', 'automatic hatchback'"),
                ),
                'required' => array('query'),
            ),
        ),
        array(
            'name' => 'book_appointment',
            'description' => 'Book a test drive OR a trade-in valuation slot. Only call once you have the customer name, mobile number, email address, and a chosen date and time. Sends confirmation emails to the customer and the yard.',
            'input_schema' => array(
                'type' => 'object',
                'properties' => array(
                    'type'     => array('type' => 'string', 'enum' => array('test_drive', 'valuation')),
                    'name'     => array('type' => 'string'),
                    'phone'    => array('type' => 'string'),
                    'email'    => array('type' => 'string'),
                    'datetime' => array('type' => 'string', 'description' => "Chosen slot in plain words, e.g. 'Thu 24 Jul at 10:00'"),
                    'vehicle'  => array('type' => 'string', 'description' => 'Vehicle of interest, or the car being traded in'),
                ),
                'required' => array('type', 'name', 'phone', 'email', 'datetime'),
            ),
        ),
        array(
            'name' => 'capture_lead',
            'description' => 'Log an interested lead who is not booking a slot yet (e.g. wants finance or a callback). Call once you have name, mobile and email. Alerts the yard by email.',
            'input_schema' => array(
                'type' => 'object',
                'properties' => array(
                    'name'     => array('type' => 'string'),
                    'phone'    => array('type' => 'string'),
                    'email'    => array('type' => 'string'),
                    'interest' => array('type' => 'string'),
                    'finance'  => array('type' => 'boolean'),
                ),
                'required' => array('name', 'phone', 'email'),
            ),
        ),
        array(
            'name' => 'request_whatsapp_handoff',
            'description' => 'Signal that the customer is qualified and wants to continue with a real person on WhatsApp. The client opens WhatsApp with a full ticket.',
            'input_schema' => array('type' => 'object', 'properties' => new stdClass(), 'required' => array()),
        ),
    );
}

/* ---- Stock feed --------------------------------------------------------- */

function truchat_load_stock() {
    $urls = array_filter(array(truchat_opt('stock_api', ''), truchat_opt('stock_api_fallback', '')));
    foreach ($urls as $url) {
        $res = wp_remote_get($url, array('timeout' => 8, 'headers' => array('Accept' => 'application/json')));
        if (is_wp_error($res) || wp_remote_retrieve_response_code($res) !== 200) continue;
        $data = json_decode(wp_remote_retrieve_body($res), true);
        $list = isset($data['vehicles']) ? $data['vehicles'] : (isset($data['stock']) ? $data['stock'] : array());
        if (empty($list)) continue;
        $out = array();
        foreach (array_slice($list, 0, 40) as $v) {
            $out[] = array(
                'id'    => isset($v['stockNumber']) ? $v['stockNumber'] : (isset($v['id']) ? $v['id'] : ''),
                'brand' => strtoupper(isset($v['make']) ? $v['make'] : (isset($v['brand']) ? $v['brand'] : '')),
                'model' => isset($v['model']) ? $v['model'] : (isset($v['trim']) ? $v['trim'] : ''),
                'year'  => isset($v['year']) ? $v['year'] : '',
                'price' => (int) (isset($v['price']) ? $v['price'] : (isset($v['retailPrice']) ? $v['retailPrice'] : 0)),
                'km'    => isset($v['mileage']) ? $v['mileage'] . ' km' : (isset($v['km']) ? $v['km'] : ''),
                'fuel'  => isset($v['fuelType']) ? $v['fuelType'] : (isset($v['fuel']) ? $v['fuel'] : ''),
            );
        }
        if (!empty($out)) return $out;
    }
    return null;
}

function truchat_stock_summary($list) {
    if (empty($list)) return '';
    $lines = array();
    foreach (array_slice($list, 0, 25) as $v) {
        $lines[] = '- ' . trim($v['year'] . ' ' . $v['brand'] . ' ' . $v['model'])
            . ' — R ' . number_format($v['price'], 0, '.', ',')
            . ($v['km'] ? ' · ' . $v['km'] : '');
    }
    return implode("\n", $lines);
}

function truchat_match_stock($list, $query) {
    $q = strtolower((string) $query);
    if ($q === '') return array_slice($list, 0, 5);
    $words = array_filter(preg_split('/\s+/', $q), function ($w) { return strlen($w) > 2; });
    $scored = array();
    foreach ($list as $v) {
        $blob = strtolower($v['year'] . ' ' . $v['brand'] . ' ' . $v['model'] . ' ' . $v['fuel']);
        $hits = 0;
        foreach ($words as $w) if (strpos($blob, $w) !== false) $hits++;
        if ($hits > 0) $scored[] = array('v' => $v, 'hits' => $hits);
    }
    usort($scored, function ($a, $b) { return $b['hits'] - $a['hits']; });
    if (empty($scored)) return array_slice($list, 0, 6);
    return array_slice(array_map(function ($s) { return $s['v']; }, $scored), 0, 6);
}

/* ---- Anthropic call ----------------------------------------------------- */

function truchat_anthropic($messages, $system, $tools) {
    $key = truchat_opt('api_key', '');
    if (!$key) return new WP_Error('no_key', 'Missing API key');

    // Day's spend ceiling. The knowledge base still answers, and the widget
    // falls back to WhatsApp, so hitting this degrades rather than breaks.
    if (!truchat_api_budget_ok()) {
        return new WP_Error('budget', 'Daily API budget reached');
    }

    $res = wp_remote_post('https://api.anthropic.com/v1/messages', array(
        'timeout' => 45,
        'headers' => array(
            'x-api-key'         => $key,
            'anthropic-version' => '2023-06-01',
            'content-type'      => 'application/json',
        ),
        'body' => wp_json_encode(array(
            'model'      => truchat_opt('model', TRUCHAT_DEFAULT_MODEL),
            'max_tokens' => 1024,
            // Cache the knowledge-base system prompt so repeat turns read it at ~10% cost.
            'system'     => array(array('type' => 'text', 'text' => $system, 'cache_control' => array('type' => 'ephemeral'))),
            'tools'      => $tools,
            'messages'   => $messages,
        )),
    ));

    if (is_wp_error($res)) return $res;
    $code = wp_remote_retrieve_response_code($res);
    $data = json_decode(wp_remote_retrieve_body($res), true);
    if ($code !== 200) {
        $msg = isset($data['error']['message']) ? $data['error']['message'] : 'HTTP ' . $code;
        return new WP_Error('api', $msg);
    }
    return $data;
}

/* ---- Gemini backup brain ------------------------------------------------ *
 *
 * Used when Claude can't answer — no Anthropic key, no credit, an API error, or
 * the daily cap. Text-only (no tool use), so Ray keeps talking and qualifying
 * even when the primary brain is unavailable; stock cards and slot booking stay
 * with Claude. Returns the reply string, or WP_Error.
 *
 * The key travels in the x-goog-api-key header, never the URL.
 */
function truchat_gemini($messages, $system) {
    $key = truchat_opt('gemini_key', '');
    if ($key === '') return new WP_Error('no_gemini_key', 'No Gemini key set');
    if (!truchat_api_budget_ok()) return new WP_Error('budget', 'Daily API budget reached');

    $model = truchat_opt('gemini_model', 'gemini-2.0-flash');

    // Gemini wants {role: user|model, parts:[{text}]} — skip tool/array blocks.
    $contents = array();
    foreach ($messages as $m) {
        if (!isset($m['content']) || !is_string($m['content']) || trim($m['content']) === '') continue;
        $contents[] = array(
            'role'  => (($m['role'] ?? '') === 'assistant') ? 'model' : 'user',
            'parts' => array(array('text' => $m['content'])),
        );
    }
    if (empty($contents)) return new WP_Error('gemini_empty_in', 'Nothing to send');

    $res = wp_remote_post(
        'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent',
        array(
            'timeout' => 45,
            'headers' => array(
                'content-type'    => 'application/json',
                'x-goog-api-key'  => $key,
            ),
            'body' => wp_json_encode(array(
                'systemInstruction' => array('parts' => array(array('text' => $system))),
                'contents'          => $contents,
                'generationConfig'  => array('maxOutputTokens' => 800, 'temperature' => 0.6),
            )),
        )
    );

    if (is_wp_error($res)) return $res;
    $code = wp_remote_retrieve_response_code($res);
    $data = json_decode(wp_remote_retrieve_body($res), true);
    if ($code !== 200) {
        return new WP_Error('gemini', isset($data['error']['message']) ? $data['error']['message'] : 'HTTP ' . $code);
    }

    $text = '';
    if (!empty($data['candidates'][0]['content']['parts'])) {
        foreach ($data['candidates'][0]['content']['parts'] as $p) {
            if (isset($p['text'])) $text .= $p['text'];
        }
    }
    $text = trim($text);
    return $text !== '' ? $text : new WP_Error('gemini_empty', 'Empty reply from Gemini');
}

/* ---- WhatsApp handoff (free tap-to-chat) -------------------------------- *
 * Builds a natural, first-person message the customer taps to send to the yard.
 * Reads like they wrote it, but carries every detail the dealer needs. No Cloud
 * API — just a pre-filled wa.me message.
 */
function truchat_whatsapp_text($session) {
    $s = $session;
    $name = trim((string) ($s['name'] ?? ''));
    $greet = $name !== '' ? "Hi, I'm {$name}." : "Hi there!";

    if (!empty($s['appointment'])) {
        $intent = "I'd like to confirm my " . $s['appointment'] . ".";
    } elseif (!empty($s['tradeInDetails'])) {
        $intent = "I'd like to trade in my " . $s['tradeInDetails'] . ".";
    } elseif (!empty($s['financeInterest'])) {
        $intent = "I'm interested in finance" . (!empty($s['vehicleInterest']) ? " on the " . $s['vehicleInterest'] : "") . ".";
    } elseif (!empty($s['vehicleInterest'])) {
        $intent = "I'm interested in the " . $s['vehicleInterest'] . ".";
    } else {
        $intent = "I'd like some help with a vehicle.";
    }

    $contact = array();
    if (!empty($s['phone'])) $contact[] = "my number is " . $s['phone'];
    if (!empty($s['email'])) $contact[] = "email " . $s['email'];
    $contact_line = $contact ? ' ' . ucfirst(implode(', ', $contact)) . '.' : '';

    return trim($greet . ' ' . $intent . $contact_line)
        . "\n\n(Sent from the " . truchat_opt('dealer_name', 'Your Car Guy') . " website chat)";
}

/** Attach a ready-to-send message + dealer number to every WhatsApp action. */
function truchat_finalize($reply, $actions, $session, $extra = array()) {
    $phone = preg_replace('/\D/', '', truchat_opt('sales_whatsapp', '27834659921'));
    foreach ($actions as &$a) {
        if (($a['type'] ?? '') === 'whatsapp') {
            $a['text']  = truchat_whatsapp_text($session);
            $a['phone'] = $phone;
        }
    }
    unset($a);
    return array_merge(array('reply' => $reply, 'actions' => $actions, 'session' => $session), $extra);
}

/* ---- Main handler ------------------------------------------------------- */

function truchat_handle_chat($body) {
    $session = array_merge(array(
        'name' => '', 'phone' => '', 'email' => '', 'vehicleInterest' => '',
        'appointment' => '', 'tradeInDetails' => '', 'financeInterest' => false, 'qualified' => false,
    ), is_array($body['session'] ?? null) ? $body['session'] : array());

    $actions = array();

    // Stock: live feed, else catalog from the client.
    $stock = truchat_load_stock();
    if ($stock === null) $stock = is_array($body['catalog'] ?? null) ? $body['catalog'] : array();

    $system = truchat_system_prompt(truchat_stock_summary($stock));
    $tools  = truchat_tools();

    // Persona: the WhatsApp bubble speaks as a real human team member; the Ray
    // bubble speaks as the AI assistant. Same knowledge, different voice.
    $persona = isset($body['persona']) ? $body['persona'] : 'ray';
    if ($persona === 'human') {
        $system .= "\n\n## PERSONA OVERRIDE — you are a person, not a bot\n"
            . "You are a real member of the " . truchat_opt('dealer_name', 'Your Car Guy')
            . " team replying on WhatsApp. You are NOT an AI and NOT named 'Ray'. Never say you are "
            . "an assistant, a bot or AI, and never mention Ray or a chatbot. Write like a friendly "
            . "person texting a customer — casual, warm, first person (\"I\", \"we\"), short messages, "
            . "natural South African English. Every fact, tool, booking step and rule above still "
            . "applies exactly the same; only your voice changes.";
    }

    // Normalise history.
    $messages = array();
    foreach ((array) ($body['messages'] ?? array()) as $m) {
        if (!is_array($m) || empty($m['role']) || !isset($m['content'])) continue;
        if ($m['role'] !== 'user' && $m['role'] !== 'assistant') continue;
        $messages[] = array('role' => $m['role'], 'content' => $m['content']);
    }
    // Anthropic requires the first message to be role "user". The widget seeds an
    // opening assistant greeting into its history — drop any leading assistant turns.
    while (!empty($messages) && $messages[0]['role'] !== 'user') array_shift($messages);
    if (empty($messages)) return array('reply' => '', 'actions' => array(), 'session' => $session);

    // --- Knowledge-first: try to answer the last user message for free. ---
    $last_user = '';
    for ($i = count($messages) - 1; $i >= 0; $i--) {
        if ($messages[$i]['role'] === 'user' && is_string($messages[$i]['content'])) { $last_user = $messages[$i]['content']; break; }
    }
    // The FAQ layer answers as "Ray" — skip it for the human persona so the
    // WhatsApp bubble always speaks in the human voice (via the LLM).
    $faq = ($persona === 'human') ? null : truchat_faq_match($last_user);
    if ($faq !== null) {
        return truchat_finalize($faq['reply'], $faq['actions'], $session, array(
            'suggestions' => $faq['suggestions'],
            'source'      => 'knowledge',
        ));
    }

    $final_text = '';

    for ($turn = 0; $turn < TRUCHAT_MAX_TURNS; $turn++) {
        $resp = truchat_anthropic($messages, $system, $tools);
        if (is_wp_error($resp)) {
            error_log('[TruChat] Claude: ' . $resp->get_error_message());

            // Backup brain — keeps Ray answering when Claude has no key/credit.
            $gemini = truchat_gemini($messages, $system);
            if (!is_wp_error($gemini)) {
                return truchat_finalize($gemini, $actions, $session, array('source' => 'gemini'));
            }
            error_log('[TruChat] Gemini: ' . $gemini->get_error_message());

            return array(
                'reply'   => "Sorry, I hit a snag just now. Please try again, or reach the yard on WhatsApp.",
                'actions' => array(array('type' => 'whatsapp')),
                'session' => $session,
            );
        }

        $content = isset($resp['content']) ? $resp['content'] : array();
        $texts = array();
        foreach ($content as $b) if (($b['type'] ?? '') === 'text') $texts[] = $b['text'];
        if (!empty($texts)) $final_text = trim(implode("\n", $texts));

        if (($resp['stop_reason'] ?? '') !== 'tool_use') break;

        // Echo assistant turn (with tool_use blocks).
        $messages[] = array('role' => 'assistant', 'content' => $content);

        $tool_results = array();
        foreach ($content as $b) {
            if (($b['type'] ?? '') !== 'tool_use') continue;
            $input = isset($b['input']) ? $b['input'] : array();
            $result_text = 'done';

            if ($b['name'] === 'search_stock') {
                $matches = truchat_match_stock($stock, $input['query'] ?? '');
                $actions[] = array('type' => 'stock', 'vehicles' => $matches);
                if (!empty($matches) && $session['vehicleInterest'] === '') {
                    $session['vehicleInterest'] = $matches[0]['brand'] . ' ' . $matches[0]['model'];
                }
                $result_text = !empty($matches)
                    ? 'Showing ' . count($matches) . ' vehicle(s) to the customer.'
                    : 'No matching stock. Suggest alternatives or invite them to browse the website.';

            } elseif ($b['name'] === 'book_appointment') {
                $session['name']  = $input['name']  ?? $session['name'];
                $session['phone'] = $input['phone'] ?? $session['phone'];
                $session['email'] = $input['email'] ?? $session['email'];
                $session['appointment'] = (($input['type'] ?? '') === 'valuation' ? 'Trade-in valuation' : 'Test drive') . ' — ' . ($input['datetime'] ?? '');
                if (!empty($input['vehicle'])) $session['vehicleInterest'] = $input['vehicle'];
                if (($input['type'] ?? '') === 'valuation' && !empty($input['vehicle'])) $session['tradeInDetails'] = $input['vehicle'];
                $session['qualified'] = true;
                $summary = truchat_summarise($messages);
                truchat_store_lead($session, $summary);
                $email = truchat_send_lead_emails($session, $summary);
                $actions[] = array('type' => 'booked', 'appointment' => $session['appointment'], 'email' => $email);
                $actions[] = array('type' => 'whatsapp');
                $result_text = 'Booking recorded. Emails — dealer: ' . ($email['dealer'] ? 'sent' : 'no') . ', customer: ' . ($email['customer'] ? 'sent' : 'no') . '. Confirm warmly to the customer.';

            } elseif ($b['name'] === 'capture_lead') {
                $session['name']  = $input['name']  ?? $session['name'];
                $session['phone'] = $input['phone'] ?? $session['phone'];
                $session['email'] = $input['email'] ?? $session['email'];
                if (!empty($input['interest'])) $session['vehicleInterest'] = $input['interest'];
                $session['financeInterest'] = !empty($input['finance']) || $session['financeInterest'];
                $session['qualified'] = true;
                $summary = truchat_summarise($messages);
                truchat_store_lead($session, $summary);
                $email = truchat_send_lead_emails($session, $summary);
                $actions[] = array('type' => 'lead', 'email' => $email);
                $actions[] = array('type' => 'whatsapp');
                $result_text = 'Lead logged. Emails — dealer: ' . ($email['dealer'] ? 'sent' : 'no') . ', customer: ' . ($email['customer'] ? 'sent' : 'no') . '.';

            } elseif ($b['name'] === 'request_whatsapp_handoff') {
                $session['qualified'] = true;
                $actions[] = array('type' => 'whatsapp');
                $result_text = 'WhatsApp handoff shown to the customer.';
            }

            $tool_results[] = array('type' => 'tool_result', 'tool_use_id' => $b['id'], 'content' => $result_text);
        }
        $messages[] = array('role' => 'user', 'content' => $tool_results);
    }

    return truchat_finalize($final_text !== '' ? $final_text : 'Sorry — could you say that again?', $actions, $session);
}

function truchat_summarise($messages) {
    $lines = array();
    foreach (array_slice($messages, -8) as $m) {
        if (!is_string($m['content'])) continue;
        $lines[] = ($m['role'] === 'user' ? 'Customer' : 'Ray') . ': ' . $m['content'];
    }
    return implode("\n", $lines);
}
