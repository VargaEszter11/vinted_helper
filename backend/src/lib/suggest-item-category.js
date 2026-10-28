import { readFile } from 'node:fs/promises';

import { config } from '../config.js';
import { pool } from '../db.js';
import { MAX_IMAGE_BYTES } from './images.js';
import { RecognitionError, deepseekChat } from './item-recognition.js';
import { photoFileInfo } from './photo-files.js';
import { isValidVintedCategoryId, vintedCategoryPromptBlock } from './vinted-categories.js';

const MAX_IMAGES = 3;
const RETRY_PROMPT =
  'Reply again with ONLY the JSON object {"category":"<id>"} using an id from the list.';

const SYSTEM_PROMPT = `You pick the best Vinted marketplace category for a seller's inventory item.

Reply with ONLY one JSON object, no markdown:
{"category":"<id>"}

The id MUST be copied exactly from this list (format: group.section.item):
${vintedCategoryPromptBlock()}

Rules:
- Use the item description (name, brand, size, measurements, flaws) as the main signal.
- When photos are attached, use them only if the text is missing, vague, or ambiguous.
- Prefer the most specific leaf that fits (e.g. women's jeans under Women's Fashion › Clothing › Jeans).
- Beauty & Care on Vinted is for brand-new/sealed items only; pick it only when the description says new/sealed.
- If the item clearly belongs under Pet Care, Home, Electronics, etc., pick there instead of fashion.`;

function descriptionText(details) {
  const lines = [];
  if (details.name?.trim()) lines.push(`Name: ${details.name.trim()}`);
  if (details.brand?.trim()) lines.push(`Brand: ${details.brand.trim()}`);
  if (details.size?.trim()) lines.push(`Size: ${details.size.trim()}`);
  if (details.measurements?.trim()) lines.push(`Measurements: ${details.measurements.trim()}`);
  if (details.flaws?.trim()) lines.push(`Flaws: ${details.flaws.trim()}`);
  return lines.join('\n');
}

function parseCategory(content) {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  let data;
  try {
    data = JSON.parse(content.slice(start, end + 1));
  } catch {
    return null;
  }
  const category = typeof data?.category === 'string' ? data.category.trim() : '';
  return isValidVintedCategoryId(category) ? category : null;
}

async function readStoredPhotoBase64(storagePath) {
  const info = await photoFileInfo(storagePath);
  if (!info || info.size > MAX_IMAGE_BYTES) return null;
  const buffer = await readFile(info.file);
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  return buffer.toString('base64');
}

/** Loads up to `limit` JPEGs already saved for the item (skips missing or oversized files). */
export async function loadItemPhotoBase64(userId, itemId, limit = MAX_IMAGES) {
  const { rows } = await pool.query(
    `select p.storage_path from item_photos p
     join items i on i.id = p.item_id
     where p.item_id = $1 and i.user_id = $2
     order by p.position
     limit $3`,
    [itemId, userId, limit],
  );
  const images = [];
  for (const row of rows) {
    if (images.length >= limit) break;
    const data = await readStoredPhotoBase64(row.storage_path);
    if (data) images.push(data);
  }
  return images;
}

/**
 * Suggests a category from the item description and up to 3 JPEGs (client uploads and/or
 * photos already stored for `itemId`).
 */
export async function suggestItemCategory(userId, details, { itemId = null, clientImages = [] } = {}) {
  if (!config.deepseekApiKey) {
    throw new RecognitionError('Category suggestions are not set up on this server.', 503);
  }
  const text = descriptionText(details);
  if (text === '' && clientImages.length === 0 && !itemId) {
    throw new RecognitionError('Add a name or description before suggesting a category.', 400);
  }

  const images = [...clientImages.slice(0, MAX_IMAGES)];
  if (itemId && images.length < MAX_IMAGES) {
    const stored = await loadItemPhotoBase64(userId, itemId, MAX_IMAGES - images.length);
    images.push(...stored);
  }

  const userContent = [
    {
      type: 'text',
      text:
        images.length > 0
          ? `Pick the best category for this inventory item.\n\n${text || 'The seller did not type a description; use the photos.'}`
          : `Pick the best category from the description alone.\n\n${text}`,
    },
    ...images.map((data) => ({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${data}` },
    })),
  ];

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];

  let reply = await deepseekChat(messages);
  let category = parseCategory(reply.content);
  if (!category) {
    reply = await deepseekChat([
      ...messages,
      { role: 'assistant', content: reply.content.slice(0, 500) },
      { role: 'user', content: RETRY_PROMPT },
    ]);
    category = parseCategory(reply.content);
  }
  if (!category) throw new RecognitionError('Could not read a category from the AI. Try again.', 502);

  return { category, usage: reply.usage, used_photos: images.length };
}
