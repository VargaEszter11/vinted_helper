import { STATUSES } from '../config.js';
import { pool } from '../db.js';
import { dissolveSmallBundles } from '../lib/bundles.js';
import { deleteItemPhotoFiles } from '../lib/photo-files.js';
import { photoLink } from '../lib/photo-links.js';
import { idParams, isoDate, price } from './schemas.js';

const ITEM_SELECT = `
  select i.*, b.listed_for as bundle_listed_for,
    coalesce(
      json_agg(
        json_build_object('id', p.id, 'item_id', p.item_id, 'storage_path', p.storage_path, 'position', p.position)
        order by p.position
      ) filter (where p.id is not null),
      '[]'
    ) as item_photos
  from items i
  left join bundles b on b.id = i.bundle_id
  left join item_photos p on p.item_id = i.id`;

const withPhotoLinks = (row) => ({
  ...row,
  item_photos: row.item_photos.map((photo) => ({ ...photo, url: photoLink(photo.id) })),
});

const optionalText = { type: ['string', 'null'], maxLength: 2000 };

const itemBody = {
  type: 'object',
  required: ['name', 'bought_for', 'status'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 200 },
    bought_for: price,
    listed_for: { ...price, type: ['number', 'null'] },
    status: { type: 'string', enum: STATUSES },
    sold_for: { ...price, type: ['number', 'null'] },
    sold_date: { ...isoDate, type: ['string', 'null'] },
    brand: optionalText,
    size: optionalText,
    measurements: optionalText,
    flaws: optionalText,
  },
};

export default async function itemRoutes(app) {
  const auth = { onRequest: [app.authenticate] };

  app.get(
    '/items',
    {
      ...auth,
      schema: {
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            orderBy: { type: 'string', enum: ['created_at', 'sold_date'] },
          },
        },
      },
    },
    async (req, reply) => {
      const statuses = (req.query.status ?? STATUSES.join(',')).split(',');
      if (!statuses.every((s) => STATUSES.includes(s))) {
        return reply.code(400).send({ message: 'Bad status.' });
      }
      const order =
        req.query.orderBy === 'sold_date'
          ? 'i.sold_date desc nulls last, i.created_at desc'
          : 'i.created_at desc';
      const { rows } = await pool.query(
        `${ITEM_SELECT} where i.user_id = $1 and i.status = any($2) group by i.id, b.id order by ${order}`,
        [req.user.sub, statuses],
      );
      return rows.map(withPhotoLinks);
    },
  );

  // Creates or updates an item. The id is chosen by the client so a retry is harmless.
  app.put('/items/:id', { ...auth, schema: { params: idParams, body: itemBody } }, async (req, reply) => {
    const b = req.body;
    if (b.status === 'sold' && (b.sold_for == null || b.sold_date == null)) {
      return reply.code(400).send({ message: 'Sold items need a sold price and date.' });
    }
    const sold = b.status === 'sold';
    const { rowCount } = await pool.query(
      `insert into items (id, user_id, name, bought_for, listed_for, status, sold_for, sold_date, brand, size, measurements, flaws)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       on conflict (id) do update set
         name = excluded.name, bought_for = excluded.bought_for, listed_for = excluded.listed_for,
         status = excluded.status, sold_for = excluded.sold_for, sold_date = excluded.sold_date,
         brand = excluded.brand, size = excluded.size, measurements = excluded.measurements, flaws = excluded.flaws,
         -- Taking an item off the market (in stock) or selling it on its own takes it out of its bundle.
         bundle_id = case
           when excluded.status = items.status or excluded.status = 'listed' then items.bundle_id
         end
       where items.user_id = excluded.user_id`,
      [
        req.params.id,
        req.user.sub,
        b.name.trim(),
        b.bought_for,
        b.listed_for ?? null,
        b.status,
        sold ? b.sold_for : null,
        sold ? b.sold_date : null,
        b.brand ?? null,
        b.size ?? null,
        b.measurements ?? null,
        b.flaws ?? null,
      ],
    );
    if (rowCount === 0) return reply.code(404).send({ message: 'Item not found.' });
    await dissolveSmallBundles(req.user.sub);
    return { ok: true };
  });

  app.post(
    '/items/:id/sold',
    {
      ...auth,
      schema: {
        params: idParams,
        body: {
          type: 'object',
          required: ['sold_for', 'sold_date'],
          properties: { sold_for: price, sold_date: isoDate },
        },
      },
    },
    async (req, reply) => {
      // Sold on its own, so it leaves its bundle (bundles are sold with POST /bundles/:id/sold).
      const { rowCount } = await pool.query(
        `update items set status = 'sold', sold_for = $3, sold_date = $4, bundle_id = null
         where id = $1 and user_id = $2`,
        [req.params.id, req.user.sub, req.body.sold_for, req.body.sold_date],
      );
      if (rowCount === 0) return reply.code(404).send({ message: 'Item not found.' });
      await dissolveSmallBundles(req.user.sub);
      return { ok: true };
    },
  );

  app.get('/items/:id/history', { ...auth, schema: { params: idParams } }, async (req, reply) => {
    const { rows } = await pool.query(
      `select h.status, h.changed_at
       from item_status_history h
       join items i on i.id = h.item_id
       where h.item_id = $1 and i.user_id = $2
       order by h.changed_at desc, h.id desc`,
      [req.params.id, req.user.sub],
    );
    return rows;
  });

  app.delete('/items/:id', { ...auth, schema: { params: idParams } }, async (req, reply) => {
    const { rowCount } = await pool.query('delete from items where id = $1 and user_id = $2', [
      req.params.id,
      req.user.sub,
    ]);
    if (rowCount === 0) return reply.code(404).send({ message: 'Item not found.' });
    await deleteItemPhotoFiles(req.params.id);
    await dissolveSmallBundles(req.user.sub);
    return { ok: true };
  });
}
