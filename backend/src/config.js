const env = process.env;

/** DATABASE_URL wins; otherwise the URL is built from the DB_* variables. */
function databaseUrl() {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  const { DB_USER, DB_PASSWORD, DB_NAME, DB_HOST = 'localhost', DB_PORT = '5432' } = env;
  if (!DB_USER || !DB_PASSWORD || !DB_NAME) return null;
  const auth = `${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASSWORD)}`;
  return `postgres://${auth}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
}

if (!databaseUrl() || !env.JWT_SECRET) {
  console.error('Set JWT_SECRET and either DATABASE_URL or DB_USER, DB_PASSWORD and DB_NAME.');
  process.exit(1);
}

export const config = {
  databaseUrl: databaseUrl(),
  jwtSecret: env.JWT_SECRET,
  photoDir: env.PHOTO_DIR ?? './photos',
  port: Number(env.PORT ?? 3000),
  corsOrigin: env.CORS_ORIGIN ?? '*',
  allowRegistration: (env.ALLOW_REGISTRATION ?? 'true') === 'true',
};

export const STATUSES = ['in_stock', 'listed', 'sold'];
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTOS_PER_ITEM = 20;
