import { buildApp } from './app.js';
import { config } from './config.js';
import { migrate } from './db.js';
import { ensurePhotoDir } from './lib/photo-files.js';

await migrate();
await ensurePhotoDir();

const app = await buildApp();
await app.listen({ port: config.port, host: '0.0.0.0' });
