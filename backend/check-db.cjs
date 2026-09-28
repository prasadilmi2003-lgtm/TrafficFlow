const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
});

async function check() {
  try {
    const result = await pool.query(`
      SELECT
        conrelid::regclass AS table_name,
        conname,
        pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE contype = 'f'
        AND pg_get_constraintdef(oid) LIKE '%users%'
    `);

    console.table(result.rows);
  } catch (error) {
    console.error(error);
  } finally {
    await pool.end();
  }
}

check();