'use server';

export async function updateSettingAction(key: string, value: string): Promise<{ ok: boolean; error?: string }> {
  return { ok: true };
}
