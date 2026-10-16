import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';

import { databaseStats, dumpLines, importDump, linesOf } from '../lib/db-dump.js';

const EXPORT_LINK_SECONDS = 60;

// One-time download links: opening a link in the browser cannot send the login header.
const exportLinks = new Map();

function takeExportLink(token) {
  const expires = exportLinks.get(token);
  exportLinks.delete(token);
  return expires !== undefined && expires > Date.now();
}

export default async function adminRoutes(app) {
  const admin = { onRequest: [app.requireAdmin] };

  // The import body is streamed straight into the importer instead of being buffered.
  app.addContentTypeParser('application/x-ndjson', (_req, payload, done) => done(null, payload));

  app.get('/admin/stats', admin, () => databaseStats());

  app.post('/admin/export-link', admin, async () => {
    for (const [token, expires] of exportLinks) if (expires <= Date.now()) exportLinks.delete(token);
    const token = randomBytes(32).toString('hex');
    exportLinks.set(token, Date.now() + EXPORT_LINK_SECONDS * 1000);
    return { url: `/admin/export?token=${token}` };
  });

  app.get(
    '/admin/export',
    {
      schema: {
        querystring: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } },
      },
    },
    async (req, reply) => {
      if (!takeExportLink(req.query.token)) return reply.code(403).send({ message: 'Link expired.' });
      const stamp = new Date().toISOString().slice(0, 10);
      return reply
        .header('Content-Type', 'application/x-ndjson')
        .header('Content-Disposition', `attachment; filename="vinted-helper-${stamp}.ndjson"`)
        .header('Cache-Control', 'no-store')
        .send(Readable.from(dumpLines()));
    },
  );

  app.post('/admin/import', admin, async (req, reply) => {
    if (typeof req.body?.pipe !== 'function') {
      return reply.code(415).send({ message: 'Send the export file as application/x-ndjson.' });
    }
    try {
      const counts = await importDump(linesOf(req.body));
      return { ok: true, ...counts };
    } catch (error) {
      req.log.error(error);
      return reply.code(400).send({ message: error.message });
    }
  });
}
