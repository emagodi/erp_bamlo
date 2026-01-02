import type { UserRole } from '@/lib/workflow';

const OFFICE_GATED_ROLES: ReadonlySet<UserRole> = new Set(['QS', 'SENIOR_QS', 'SALES', 'PROJECT_MANAGER', 'PROJECT_TEAM']);

export function rolesRequireOffice(role: UserRole): boolean {
  return OFFICE_GATED_ROLES.has(role);
}

export function resolveOfficeForRole(role: UserRole | null, office: string | null | undefined): string | null {
  if (!role) return office ?? null;
  if (!rolesRequireOffice(role)) return office ?? null;
  if (!office) {
    throw new Error('Your office is not configured. Please contact an administrator.');
  }
  return office;
}

export function ensureQuoteOffice(
  quoteOffice: string | null,
  role: UserRole,
  userOffice: string | null | undefined,
): string | null {
  const resolved = resolveOfficeForRole(role, userOffice);
  if (!rolesRequireOffice(role)) {
    return quoteOffice ?? resolved;
  }
  if (quoteOffice && resolved && quoteOffice !== resolved) {
    throw new Error('This quote belongs to a different office');
  }
  return quoteOffice ?? resolved;
}

export function officesDiffer(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && a !== b;
}

export { OFFICE_GATED_ROLES };
