import { pool } from '../db.js';
import { dissolveSmallBundles, splitEvenly } from '../lib/bundles.js';
import { idParams, isoDate, price } from './schemas.js';

/** An error Fastify answers with the given status code and message. */
function httpError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

/** Runs `work` in a transaction on one connection; a thrown error rolls it back. */
async function inTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}

const itemIdsSchema = {
  type: 'array',
  minItems: 2,
  maxItems: 100,
  uniqueItems: true,
  items: { type: 'string', format: 'uuid' },
};

/**
 * Puts the user's unsold items into the bundle, marking them listed unless they are about
 * to be sold (so their status history doesn't get a meaningless "listed"). All or nothing.
 */
async function moveItemsIntoBundle(client, bundleId, userId, itemIds, { markListed = true } = {}) {
  const { rowCount } = await client.query(
    `update items set bundle_id = $1, status = case when $4 then 'listed' else status end
     where id = any($2) and user_id = $3 and status <> 'sold'`,
    [bundleId, itemIds, userId, markListed],
  );
  if (rowCount !== itemIds.length) {
    throw httpError(400, 'Some items were not found or are already sold. Refresh and try again.');
  }
}

/** Creates a bundle from the items; bundles they leave behind empty are removed. */
async function addItemsToNewBundle(client, { bundleId, userId, listedFor, itemIds }) {
  const { rowCount } = await client.query(
    `insert into bundles (id, user_id, listed_for) values ($1, $2, $3) on conflict (id) do nothing`,
    [bundleId, userId, listedFor],
  );
  if (rowCount === 0) throw httpError(409, 'That bundle already exists.');
  await moveItemsIntoBundle(client, bundleId, userId, itemIds, { markListed: false });
  await dissolveSmallBundles(userId, client);
}

export default async function bundleRoutes(app) {
  const auth = { onRequest: [app.authenticate] };

  // Lists the given unsold items together for one price and marks them listed.
  // Items already in another bundle move to this one. The id is chosen by the client.
  app.put(
    '/bundles/:id',
    {
      ...auth,
      schema: {
        params: idParams,
        body: {
          type: 'object',
          required: ['listed_for'],
          additionalProperties: false,
          properties: { listed_for: price, item_ids: itemIdsSchema },
        },
      },
    },
    async (req, reply) => {
      const userId = req.user.sub;
      const { listed_for: listedFor, item_ids: itemIds } = req.body;

      return inTransaction(async (client) => {
        const { rows } = await client.query(
          `insert into bundles (id, user_id, listed_for) values ($1, $2, $3)
           on conflict (id) do update set listed_for = excluded.listed_for
           where bundles.user_id = excluded.user_id
           returning id`,
          [req.params.id, userId, listedFor],
        );
        if (rows.length === 0) return reply.code(404).send({ message: 'Bundle not found.' });

        if (itemIds) await moveItemsIntoBundle(client, req.params.id, userId, itemIds);
        // Also drops this bundle if it was created without enough items.
        await dissolveSmallBundles(userId, client);
        return { ok: true };
      });
    },
  );

  // Unbundles: the items stay listed, each with its own price.
  app.delete('/bundles/:id', { ...auth, schema: { params: idParams } }, async (req, reply) => {
    const { rowCount } = await pool.query('delete from bundles where id = $1 and user_id = $2', [
      req.params.id,
      req.user.sub,
    ]);
    if (rowCount === 0) return reply.code(404).send({ message: 'Bundle not found.' });
    return { ok: true };
  });

  // Sells every unsold item in the bundle, splitting the sold price evenly between them.
  // With `item_ids` it first creates the bundle from those items: for when a buyer bundles
  // items that weren't listed together.
  app.post(
    '/bundles/:id/sold',
    {
      ...auth,
      schema: {
        params: idParams,
        body: {
          type: 'object',
          required: ['sold_for', 'sold_date'],
          additionalProperties: false,
          properties: { sold_for: price, sold_date: isoDate, item_ids: itemIdsSchema },
        },
      },
    },
    async (req, reply) =>
      inTransaction(async (client) => {
        if (req.body.item_ids) {
          await addItemsToNewBundle(client, {
            bundleId: req.params.id,
            userId: req.user.sub,
            listedFor: req.body.sold_for,
            itemIds: req.body.item_ids,
          });
        }

        const { rows } = await client.query(
          `select i.id from items i
           join bundles b on b.id = i.bundle_id
           where b.id = $1 and b.user_id = $2 and i.status <> 'sold'
           order by i.created_at, i.id
           for update of i`,
          [req.params.id, req.user.sub],
        );
        if (rows.length === 0) return reply.code(404).send({ message: 'Bundle not found.' });

        const shares = splitEvenly(req.body.sold_for, rows.length);
        for (const [index, row] of rows.entries()) {
          await client.query(
            `update items set status = 'sold', sold_for = $2, sold_date = $3 where id = $1`,
            [row.id, shares[index], req.body.sold_date],
          );
        }
        return { ok: true };
      }),
  );
}
