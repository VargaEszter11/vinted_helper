import { config } from '../config.js';

// ---------------------------------------------------------------------------
// Provider settings. To switch provider or model, change this block (and, if the provider
// is not OpenAI-compatible, callProvider() below).
// ---------------------------------------------------------------------------

const PROVIDER_BASE_URL = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com';
const PROVIDER_MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-flash';
// Thinking mode makes the model reason before answering: usually more accurate on hard
// items, but slower (about 10 to 40 s) and it bills extra reasoning tokens.
// Switch on with DEEPSEEK_THINKING=true in .env.
const THINKING = process.env.DEEPSEEK_THINKING === 'true';
const REQUEST_TIMEOUT_MS = THINKING ? 90_000 : 45_000;
const MAX_OUTPUT_TOKENS = THINKING ? 4000 : 700;

export const CATEGORIES = ['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'bags', 'accessories', 'other'];
export const CONDITIONS = ['new_with_tags', 'very_good', 'good', 'fair'];
export const CONFIDENCES = ['low', 'medium', 'high'];

const SYSTEM_PROMPT = `You are an expert at identifying second-hand clothing, shoes and fashion accessories from photos, for a reseller who is deciding whether to buy. Be as specific and exact as the photos allow.

Work in this order:
1. Read every piece of text you can see: brand tags, logos, size labels, care and composition labels, product or style codes, embossed or printed names. Put it in "visible_text".
2. From that text and from unmistakable design features, identify the brand, then the exact model or style, then the item type.

Reply with ONLY one JSON object, no other text and no markdown, with exactly these keys:
{
  "visible_text": string or null,
  "brand": string or null,
  "model": string or null,
  "item_type": string or null,
  "category": one of ${CATEGORIES.map((c) => `"${c}"`).join(', ')},
  "size": string or null,
  "colour": string or null,
  "material": string or null,
  "condition": one of ${CONDITIONS.map((c) => `"${c}"`).join(', ')} or null,
  "suggested_name": string or null,
  "search_phrase": string or null,
  "confidence": one of ${CONFIDENCES.map((c) => `"${c}"`).join(', ')}
}

Rules:
- "visible_text": the text you read, separated by " | ", for example "ZARA | M | EUR 38 | 60% wool 40% polyester". null if there is none.
- "brand": take it from a tag or logo. You may also name a brand from an unmistakable trademark design (for example three stripes, a swoosh, a signature pattern or hardware). Do not guess from general style. If you are not sure, use null.
- "model": the product line, style or model name or number when you can tell it from a tag, a style code or an unmistakable design, for example "501", "Air Force 1", "Stan Smith", "Classic Flap", "Chuck Taylor All Star". null if you cannot tell. Never invent a model.
- "item_type": English and as specific as the photos support: the garment plus its cut, fit and key details, for example "high-waist wide-leg jeans", "double-breasted wool blazer", "oversized hooded sweatshirt", "pleated midi skirt", "low-top leather sneakers". Never answer only "top", "shirt", "jacket" or "shoes" when more detail is visible.
- "size": from the size tag, with both systems if shown, for example "M" or "M / EU 38". Never guess a size that is not visible.
- "material": from the composition label, with percentages if shown, for example "100% cotton". Judge it from the look only if there is no label, and then say so, for example "looks like leather".
- "colour": the main colour, plus a second one or the pattern if clear, for example "navy blue", "black and white striped".
- "condition": new_with_tags only if tags are visible and attached; otherwise judge wear (very_good, good, fair), or null if you cannot tell.
- "suggested_name": a short listing title in the form "Brand model/type colour", for example "Levi's 501 straight jeans blue". Leave out the brand or model when unknown.
- "search_phrase": 2 to 6 words a buyer would type to find the same item, with the most specific words first, for example "levis 501 blue jeans".
- Use null for anything you cannot actually see. A wrong specific answer is worse than null.
- Details the user entered are correct. Do not contradict them, and use them in suggested_name and search_phrase.
- "confidence": "high" only when a tag or label confirms the brand and the model or type is clear; "medium" when the brand or type is clear but not confirmed by text; "low" when the photos are unclear or the item is hard to identify.`;

const RETRY_PROMPT =
  'That was not a valid JSON object in the required format. Reply again with ONLY the JSON object.';

// ---------------------------------------------------------------------------

/** An error whose message is safe to show to the user. */
export class RecognitionError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

const FIELD_LABELS = { brand: 'Brand', colour: 'Colour', condition: 'Condition', size: 'Size' };

function userText(entered) {
  const lines = Object.entries(FIELD_LABELS)
    .filter(([key]) => entered[key])
    .map(([key, label]) => `- ${label}: ${entered[key]}`);
  return [
    'Identify the item in the attached photos.',
    lines.length > 0
      ? `Details entered by the user (correct, do not change them):\n${lines.join('\n')}`
      : 'The user entered no details.',
  ].join('\n\n');
}

/** OpenAI-compatible chat call to DeepSeek (shared by Buy check and item category). */
export async function deepseekChat(messages) {
  let response;
  try {
    response = await fetch(`${PROVIDER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.deepseekApiKey}` },
      body: JSON.stringify({
        model: PROVIDER_MODEL,
        messages,
        thinking: { type: THINKING ? 'enabled' : 'disabled' },
        temperature: 0,
        max_tokens: MAX_OUTPUT_TOKENS,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError';
    throw new RecognitionError(
      timedOut ? 'The image check took too long. Try again.' : 'Could not reach the image check service. Try again.',
      timedOut ? 504 : 502,
    );
  }

  if (!response.ok) {
    // Details stay in the server log (see the route); the user only gets a friendly message.
    const detail = await response.text().catch(() => '');
    const error = new RecognitionError(
      response.status === 429 || response.status === 503
        ? 'The image check service is busy right now. Try again in a moment.'
        : 'The image check service had a problem. Try again.',
      response.status === 429 || response.status === 503 ? 503 : 502,
    );
    error.providerStatus = response.status;
    error.providerDetail = detail.slice(0, 300);
    throw error;
  }

  const body = await response.json().catch(() => null);
  const content = body?.choices?.[0]?.message?.content;
  return {
    content: typeof content === 'string' ? content : '',
    usage: {
      prompt_tokens: body?.usage?.prompt_tokens ?? 0,
      completion_tokens: body?.usage?.completion_tokens ?? 0,
    },
  };
}

const cleanText = (value, max = 120) => {
  if (typeof value !== 'string') return null;
  const text = value.trim().slice(0, max);
  return text === '' || /^(null|unknown|n\/a|none)$/i.test(text) ? null : text;
};

/** Parses and checks the model's reply. Returns null when it is not usable. */
function parseReply(content) {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  let data;
  try {
    data = JSON.parse(content.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;

  const confidence = typeof data.confidence === 'string' ? data.confidence.toLowerCase() : '';
  if (!CONFIDENCES.includes(confidence)) return null;

  const category = typeof data.category === 'string' ? data.category.toLowerCase() : '';
  const condition = typeof data.condition === 'string' ? data.condition.toLowerCase() : '';
  return {
    visible_text: cleanText(data.visible_text, 400),
    brand: cleanText(data.brand),
    model: cleanText(data.model),
    item_type: cleanText(data.item_type),
    category: CATEGORIES.includes(category) ? category : 'other',
    size: cleanText(data.size),
    colour: cleanText(data.colour),
    material: cleanText(data.material),
    condition: CONDITIONS.includes(condition) ? condition : null,
    suggested_name: cleanText(data.suggested_name),
    search_phrase: cleanText(data.search_phrase),
    confidence,
  };
}

/**
 * Identifies an item from 1 to 3 base64 JPEGs. `entered` holds what the user typed
 * (brand, colour, condition, size; empty or missing means not entered).
 * Returns the model's fields and the token usage.
 */
export async function identifyItem(images, entered) {
  if (!config.deepseekApiKey) {
    throw new RecognitionError('Image check is not set up on this server.', 503);
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        { type: 'text', text: userText(entered) },
        ...images.map((data) => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${data}` } })),
      ],
    },
  ];

  const usage = { prompt_tokens: 0, completion_tokens: 0 };
  let reply = await deepseekChat(messages);
  usage.prompt_tokens += reply.usage.prompt_tokens;
  usage.completion_tokens += reply.usage.completion_tokens;

  let fields = parseReply(reply.content);
  if (!fields) {
    // One retry: show the model its bad reply and ask again.
    reply = await deepseekChat([
      ...messages,
      { role: 'assistant', content: reply.content.slice(0, 2000) },
      { role: 'user', content: RETRY_PROMPT },
    ]);
    usage.prompt_tokens += reply.usage.prompt_tokens;
    usage.completion_tokens += reply.usage.completion_tokens;
    fields = parseReply(reply.content);
  }
  if (!fields) throw new RecognitionError('Could not read the result of the image check. Try again.', 502);

  return { fields, usage };
}
