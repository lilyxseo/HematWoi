export interface HouseholdScopeBase {
  householdId: string | null;
  householdName: string | null;
  role: string | null;
  members: any[];
  memberUserIds: string[];
  currentUserId: string | null;
}

export interface HouseholdScopeSnapshot extends HouseholdScopeBase {
  enabled: boolean;
}

const defaultSnapshot: HouseholdScopeSnapshot = {
  householdId: null,
  householdName: null,
  role: null,
  members: [],
  memberUserIds: [],
  currentUserId: null,
  enabled: false,
};

let latestSnapshot: HouseholdScopeSnapshot = { ...defaultSnapshot };

export function setHouseholdScopeSnapshot(summary: HouseholdScopeBase | null | undefined, enabled: boolean) {
  if (!summary) {
    latestSnapshot = { ...defaultSnapshot, enabled: false };
    return;
  }
  latestSnapshot = {
    householdId: summary.householdId,
    householdName: summary.householdName,
    role: summary.role,
    members: summary.members,
    memberUserIds: summary.memberUserIds,
    currentUserId: summary.currentUserId,
    enabled,
  };
}

export function getHouseholdScopeSnapshot(): HouseholdScopeSnapshot {
  return { ...latestSnapshot, members: [...latestSnapshot.members] };
}
