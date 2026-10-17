import { pool } from '../db.js';
import { CONDITIONS, identifyItem, RecognitionError } from '../lib/item-recognition.js';
import { price } from './schemas.js';

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 1_500_000;
const CHECKS_PER_HOUR = 30;

const optionalText = { type: ['string', 'null'], maxLength: 60 };

const identifySchema = {
  body: {
    type: 'object',
    required: ['images', 'price'],
    additionalProperties: false,
    properties: {
      // Base64 JPEGs, without a "data:" prefix. 4 characters of base64 are 3 bytes.
      images: {
        type: 'array',
        minItems: 1,
        maxItems: MAX_IMAGES,
        items: { type: 'string', minLength: 100, maxLength: Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 4 },
      },
      price,
      brand: optionalText,
      colour: optionalText,
      size: optionalText,
      condition: { type: ['string', 'null'], enum: [...CONDITIONS, null] },
    },
  },
};

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** True when the string is base64 of a JPEG that is small enough. */
function isJpeg(data) {
  if (!BASE64.test(data)) return false;
  const bytes = Buffer.from(data, 'base64');
  return bytes.length <= MAX_IMAGE_BYTES && bytes[0] === 0xff && bytes[1] === 0xd8;
}

const clean = (value) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);

export default async function buyCheckRoutes(app) {
  app.post('/buy-check/identify', { onRequest: [app.authenticate], schema: identifySchema }, async (req, reply) => {
    const body = req.body;
    if (!body.images.every(isJpeg)) {
      return reply.code(400).send({ message: 'Photos must be JPEG files of at most 1.5 MB each.' });
    }
    const entered = {
      brand: clean(body.brand),
      colour: clean(body.colour),
      size: clean(body.size),
      condition: body.condition ?? null,
    };

    // Rate limit: counts this attempt only if the user is under the limit. The row is
    // removed again if the provider fails, so an outage does not use up their checks.
    const slot = await pool.query(
      `insert into buy_checks (user_id)
       select $1 where (select count(*) from buy_checks
                        where user_id = $1 and created_at > now() - interval '1 hour') < $2
       returning id`,
      [req.user.sub, CHECKS_PER_HOUR],
    );
    if (slot.rowCount === 0) {
      return reply
        .code(429)
        .send({ message: `You have used all ${CHECKS_PER_HOUR} checks for this hour. Try again later.` });
    }
    pool.query(`delete from buy_checks where created_at < now() - interval '1 day'`).catch(() => {});

    let result;
    try {
      result = await identifyItem(body.images, entered);
    } catch (error) {
      await pool.query('delete from buy_checks where id = $1', [slot.rows[0].id]).catch(() => {});
      if (error instanceof RecognitionError) {
        if (error.providerStatus) {
          req.log.error(
            { providerStatus: error.providerStatus, providerDetail: error.providerDetail },
            'image recognition provider error',
          );
        }
        return reply.code(error.status).send({ message: error.message });
      }
      req.log.error(error, 'buy check failed');
      return reply.code(502).send({ message: 'Something went wrong with the image check. Try again.' });
    }

    // What the user typed wins; the model only fills in what is empty.
    const fields = { ...result.fields };
    const sources = {};
    for (const key of Object.keys(fields)) {
      if (key === 'confidence') continue;
      if (key in entered && entered[key]) {
        fields[key] = entered[key];
        sources[key] = 'user';
      } else {
        sources[key] = fields[key] ? 'ai' : null;
      }
    }
    const { confidence, ...values } = fields;

    req.log.info({ usage: result.usage, images: body.images.length }, 'buy check');
    return { fields: values, sources, confidence, price: body.price, usage: result.usage };
  });
}
