/**
 * Returns the user ID of the meet owner.
 * Meet ownership is determined by the team account (if set) or the legacy team.
 */
export function getMeetOwnerId(meet: {
  team: { ownerId: string };
  teamAccount?: { ownerId: string } | null;
}): string {
  return meet.teamAccount?.ownerId ?? meet.team.ownerId;
}
