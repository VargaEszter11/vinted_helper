import { createReadStream } from 'node:fs';
import { randomUUID } from 'node:crypto';

import { MAX_PHOTO_BYTES, MAX_PHOTOS_PER_ITEM } from '../config.js';
import { pool } from '../db.js';
import {
  deletePhotoFile,
  photoFileInfo,
  savePhotoFile,
} from '../lib/photo-files.js';
import { isValidPhotoLink, photoLink } from '../lib/photo-links.js';
import { idParams } from './schemas.js';

export default async function photoRoutes(app) {
  const auth = { onRequest: [app.authenticate] };

  // Body: { data: "<base64 JPEG>" }
  app.post(
    '/items/:id/photos',
    {
      ...auth,
      schema: {
        params: idParams,
        body: { type: 'object', required: ['data'], properties: { data: { type: 'string' } } },
      },
    },
    async (req, reply) => {
      const itemId = req.params.id;
      const owned = await pool.query('select 1 from items where id = $1 and user_id = $2', [
        itemId,
        req.user.sub,
      ]);
      if (owned.rowCount === 0) return reply.code(404).send({ message: 'Item not found.' });

      const buffer = Buffer.from(req.body.data, 'base64');
      if (buffer.length === 0 || buffer.length > MAX_PHOTO_BYTES) {
        return reply.code(400).send({ message: 'Photos must be JPEG files up to 5 MB.' });
      }
      if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
        return reply.code(400).send({ message: 'Photos must be JPEG files.' });
      }

      const photoId = randomUUID();
      const storagePath = `${itemId}/${photoId}.jpg`;
      const { rows } = await pool.query(
        `insert into item_photos (id, item_id, storage_path, position)
         select $1, $2, $3, coalesce(max(position) + 1, 0)
         from item_photos where item_id = $2
         having count(*) < $4
         returning id, item_id, storage_path, position`,
        [photoId, itemId, storagePath, MAX_PHOTOS_PER_ITEM],
      );
      if (rows.length === 0) {
        return reply
          .code(400)
          .send({ message: `An item can have at most ${MAX_PHOTOS_PER_ITEM} photos.` });
      }
      await savePhotoFile(storagePath, buffer);
      return { ...rows[0], url: photoLink(photoId) };
    },
  );

  app.delete('/photos/:id', { ...auth, schema: { params: idParams } }, async (req, reply) => {
    const { rows } = await pool.query(
      `delete from item_photos p using items i
       where p.id = $1 and p.item_id = i.id and i.user_id = $2
       returning p.storage_path`,
      [req.params.id, req.user.sub],
    );
    if (rows.length === 0) return reply.code(404).send({ message: 'Photo not found.' });
    await deletePhotoFile(rows[0].storage_path);
    return { ok: true };
  });

  // Not behind the login: <Image> components cannot send an Authorization header.
  // The link carries an HMAC signature and an expiry instead.
  app.get(
    '/photos/:id',
    {
      schema: {
        params: idParams,
        querystring: {
          type: 'object',
          required: ['expires', 'sig'],
          properties: { expires: { type: 'integer' }, sig: { type: 'string' } },
        },
      },
    },
    async (req, reply) => {
      const { expires, sig } = req.query;
      if (!isValidPhotoLink(req.params.id, expires, sig)) {
        return reply.code(403).send({ message: 'Link expired.' });
      }
      const { rows } = await pool.query('select storage_path from item_photos where id = $1', [
        req.params.id,
      ]);
      const info = rows[0] && (await photoFileInfo(rows[0].storage_path));
      if (!info) return reply.code(404).send({ message: 'Photo not found.' });
      return reply
        .header('Content-Type', 'image/jpeg')
        .header('Content-Length', info.size)
        .header('Cache-Control', 'private, max-age=86400')
        .send(createReadStream(info.file));
    },
  );
}
