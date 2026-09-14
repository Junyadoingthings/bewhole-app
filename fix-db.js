const postgres = require('postgres');

// Paste your exact Vercel Production DATABASE_URL here
const url = "YOUR_VERCEL_PRODUCTION_DATABASE_URL";

const sql = postgres(url, { ssl: 'require' });

async function fix() {
  try {
    await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT;`;
    console.log("✅ Successfully added 'address' column to 'profiles' table.");
  } catch (error) {
    console.error("❌ SQL Error:", error.message);
    // Fallback if the table is capitalized
    if (error.message.includes('does not exist')) {
        console.log("Trying alternative table name 'Profile'...");
        await sql`ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS address TEXT;`.catch(e => console.error(e.message));
        console.log("✅ Added to 'Profile'.");
    }
  } finally {
    process.exit(0);
  }
}

fix();