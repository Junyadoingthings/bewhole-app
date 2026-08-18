/**
 * Password rules, shared by the register form and the server-side validator.
 *
 * Deliberately in its own module with no server-only imports so the live
 * checklist in the UI and the rule enforced on submit can never drift apart.
 */
export const PASSWORD_RULES = [
  { label: 'At least 10 characters', test: (v: string) => v.length >= 10 },
  { label: 'One lowercase letter', test: (v: string) => /[a-z]/.test(v) },
  { label: 'One uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'One number', test: (v: string) => /[0-9]/.test(v) },
] as const;

export function passwordProblems(password: string): string[] {
  return PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.label);
}
