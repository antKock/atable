/**
 * Clause PostgREST `or` des tags visibles par un owner : tags globaux
 * (household_id NULL) + tags custom de SES foyers. Sans foyer, seulement les
 * globaux — jamais de `in.()` dégénéré, que PostgREST refuse.
 */
export function visibleTagsOrClause(householdIds: string[]): string {
  return householdIds.length > 0
    ? `household_id.is.null,household_id.in.(${householdIds.join(",")})`
    : "household_id.is.null";
}
