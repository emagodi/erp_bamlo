import { QuoteStatus, STATUS_TRANSITION_RULES, UserRole, canTransition as coreCanTransition, hasRole as coreHasRole } from './workflow';

export { QuoteStatus, STATUS_TRANSITION_RULES, UserRole };

export function hasRole(user: { role: UserRole | null | undefined }, roles: UserRole[]) {
  return coreHasRole(user.role ?? undefined, roles);
}

export function canTransition(role: UserRole, from: QuoteStatus, to: QuoteStatus) {
  return coreCanTransition(role, from, to);
}
