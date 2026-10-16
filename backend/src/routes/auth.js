import { config } from '../config.js';
import { pool } from '../db.js';
import { hashPassword, verifyPassword } from '../lib/passwords.js';

const credentials = {
  body: {
    type: 'object',
    required: ['username', 'password'],
    properties: {
      username: { type: 'string', minLength: 3, maxLength: 32 },
      password: { type: 'string', minLength: 8, maxLength: 200 },
    },
  },
};

// Stricter than the global limit: these are the brute-force targets.
const limit = { rateLimit: { max: 10, timeWindow: '1 minute' } };

export default async function authRoutes(app) {
  app.post('/auth/register', { schema: credentials, config: limit }, async (req, reply) => {
    if (!config.allowRegistration) return reply.code(403).send({ message: 'Registration is closed.' });

    const username = req.body.username.trim().toLowerCase();
    if (!/^[a-z0-9._@+-]{3,32}$/.test(username)) {
      return reply
        .code(400)
        .send({ message: 'Username may only contain letters, numbers and . _ - @ +' });
    }

    if (username === config.adminUsername) {
      return reply.code(409).send({ message: 'That username is taken.' });
    }

    try {
      const { rows } = await pool.query(
        'insert into users (username, password_hash) values ($1, $2) returning id',
        [username, await hashPassword(req.body.password)],
      );
      return { token: app.jwt.sign({ sub: rows[0].id }) };
    } catch (e) {
      if (e.code === '23505') return reply.code(409).send({ message: 'That username is taken.' });
      throw e;
    }
  });

  app.post('/auth/login', { schema: credentials, config: limit }, async (req, reply) => {
    const username = req.body.username.trim().toLowerCase();
    const { rows } = await pool.query('select id, password_hash from users where username = $1', [
      username,
    ]);
    const user = rows[0];
    if (!user || !(await verifyPassword(req.body.password, user.password_hash))) {
      return reply.code(401).send({ message: 'Wrong username or password.' });
    }
    return { token: app.jwt.sign({ sub: user.id }) };
  });

  app.get('/auth/me', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { rows } = await pool.query('select username from users where id = $1', [req.user.sub]);
    if (!rows[0]) return reply.code(401).send({ message: 'Please sign in again.' });
    return { username: rows[0].username, isAdmin: rows[0].username === config.adminUsername };
  });
}
