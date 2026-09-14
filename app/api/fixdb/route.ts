import { NextResponse } from 'next/server';
import postgres from 'postgres';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) throw new Error("No database URL found");
    
    const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
    
    // Add all required profile columns at once
    await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT;`;
    await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;`;
    await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;`;
    await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS medical_aid TEXT;`;
    
    return NextResponse.json({ success: true, message: "All columns patched successfully!" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}