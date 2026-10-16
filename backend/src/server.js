import { buildApp } from './app.js';
import { config } from './config.js';
import { migrate } from './db.js';
import { ensureAdminUser } from './lib/admin-user.js';
import { ensurePhotoDir } from './lib/photo-files.js';

await migrate();
await ensureAdminUser();
await ensurePhotoDir();

const app = await buildApp();
await app.listen({ port: config.port, host: '0.0.0.0' });
