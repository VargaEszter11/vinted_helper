import { config } from '../config.js';
import { pool } from '../db.js';
import { hashPassword } from './passwords.js';

/** Creates the admin account from ADMIN_PASSWORD if it does not exist yet. Never changes an existing one. */
export async function ensureAdminUser() {
  const { rows } = await pool.query('select 1 from users where username = $1', [config.adminUsername]);
  if (rows.length > 0) return;

  if (config.adminPassword.length < 8) {
    console.warn(
      `No "${config.adminUsername}" account exists. Set ADMIN_PASSWORD (at least 8 characters) and restart to create it.`,
    );
    return;
  }
  await pool.query('insert into users (username, password_hash) values ($1, $2)', [
    config.adminUsername,
    await hashPassword(config.adminPassword),
  ]);
  console.log(`Created the "${config.adminUsername}" account.`);
}
