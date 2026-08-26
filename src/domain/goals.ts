import type { LifeAreaId, LifeEntityLink, LifeEntityRef } from './lifeAreas';
import type { JournalEntry, JournalInput } from '../stores/useAppStore';

export const GOAL_TAG = 'still-goal';
const GOAL_COMPLETED_TAG = 'goal-completed';
const GOAL_TARGET_PREFIX = 'goal-target:';

export type GoalRecord = {
  id: string;
  title: string;
  description?: string;
  targetDate?: string;
  areaId?: LifeAreaId;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
};

export type GoalDraft = {
  title: string;
  description?: string;
  targetDate?: string;
  areaId?: LifeAreaId;
  completed?: boolean;
};

export function isGoalEntry(entry: JournalEntry) {
  return entry.tags.includes(GOAL_TAG);
}

export function goalTargetDate(entry: JournalEntry) {
  return entry.tags.find((tag) => tag.startsWith(GOAL_TARGET_PREFIX))?.slice(GOAL_TARGET_PREFIX.length) || undefined;
}

export function goalFromEntry(entry: JournalEntry): GoalRecord | undefined {
  if (!isGoalEntry(entry) || !entry.title?.trim()) return undefined;
  return {
    id: entry.id,
    title: entry.title.trim(),
    description: entry.body.trim() === entry.title.trim() ? undefined : entry.body.trim(),
    targetDate: goalTargetDate(entry),
    areaId: entry.areaId,
    completed: entry.tags.includes(GOAL_COMPLETED_TAG),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export function goalJournalInput(draft: GoalDraft, entryDate: string): JournalInput {
  const title = draft.title.trim();
  const tags = [GOAL_TAG];
  if (draft.completed) tags.push(GOAL_COMPLETED_TAG);
  if (draft.targetDate) tags.push(`${GOAL_TARGET_PREFIX}${draft.targetDate}`);
  return {
    title,
    body: draft.description?.trim() || title,
    entryDate,
    mood: undefined,
    tags,
    areaId: draft.areaId,
  };
}

export function goalRef(goalId: string): LifeEntityRef {
  return { kind: 'goal', id: goalId };
}

function sameEntity(left: LifeEntityRef, right: LifeEntityRef) {
  return left.kind === right.kind && left.id === right.id;
}

export function goalConnections(goalId: string, links: LifeEntityLink[]) {
  const goal = goalRef(goalId);
  const connected: Array<{ linkId: string; ref: LifeEntityRef; type: LifeEntityLink['type'] }> = [];
  for (const link of links) {
    if (sameEntity(link.from, goal)) connected.push({ linkId: link.id, ref: link.to, type: link.type });
    else if (sameEntity(link.to, goal)) connected.push({ linkId: link.id, ref: link.from, type: link.type });
  }
  return connected;
}

export function isGoalLinked(goalId: string, ref: LifeEntityRef, links: LifeEntityLink[]) {
  return goalConnections(goalId, links).some((connection) => sameEntity(connection.ref, ref));
}
