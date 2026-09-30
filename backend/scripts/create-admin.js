const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const username = (process.env.ADMIN_SETUP_USERNAME || "").trim().toLowerCase();
const password = process.env.ADMIN_SETUP_PASSWORD || "";
const databaseUrl = process.env.DATABASE_URL || "";

let pool;

async function main() {
  if (!databaseUrl) {
    throw new Error("Render DATABASE_URL was not supplied. No database connection attempted.");
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL.");
  }

  if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol) ||
      !parsedUrl.hostname.endsWith(".render.com")) {
    throw new Error("The supplied database URL does not appear to be a Render PostgreSQL URL.");
  }

  if (!/^[a-z0-9._-]{3,100}$/.test(username)) {
    throw new Error("Username must be 3–100 characters: letters, numbers, dot, underscore, or hyphen.");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }

  pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(8675309)");

    const existing = await client.query(
      "SELECT EXISTS (SELECT 1 FROM app_users WHERE role = 'admin') AS exists"
    );

    if (existing.rows[0].exists) {
      throw new Error("An admin account already exists. No account was created.");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await client.query(
      `INSERT INTO app_users (username, password_hash, role, employee_id)
       VALUES ($1, $2, 'admin', NULL)`,
      [username, passwordHash]
    );

    await client.query("COMMIT");
    console.log("First admin account created successfully.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    const safeMessages = [
      "Render DATABASE_URL was not supplied. No database connection attempted.",
      "DATABASE_URL is not a valid URL.",
      "The supplied database URL does not appear to be a Render PostgreSQL URL.",
      "Username must be 3–100 characters: letters, numbers, dot, underscore, or hyphen.",
      "Password must be at least 8 characters long.",
      "An admin account already exists. No account was created."
    ];

    if (safeMessages.includes(error.message)) {
      console.error("Admin setup stopped:", error.message);
    } else {
      console.error("Admin setup failed. Check the Render database connection and app_users migration.");
      if (error.code) console.error("Database error code:", error.code);
    }

    process.exitCode = 1;
  })
  .finally(async () => {
    if (pool) await pool.end().catch(() => {});
  });
