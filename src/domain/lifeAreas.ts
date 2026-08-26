export const LIFE_AREA_IDS = ['work', 'love', 'health', 'money'] as const;

export type LifeAreaId = (typeof LIFE_AREA_IDS)[number];

export type LifeAreaDefinition = {
  id: LifeAreaId;
  label: string;
  description: string;
  color: string;
  privacySensitive: boolean;
};

export const LIFE_AREAS: Record<LifeAreaId, LifeAreaDefinition> = {
  work: {
    id: 'work',
    label: 'Work',
    description: 'Schedule, earnings, goals, notes, and responsibilities.',
    color: '#9582c0',
    privacySensitive: true,
  },
  love: {
    id: 'love',
    label: 'Love',
    description: 'People, relationships, milestones, memories, and reminders.',
    color: '#d58a9c',
    privacySensitive: true,
  },
  health: {
    id: 'health',
    label: 'Health',
    description: 'Habits, care, appointments, movement, and wellbeing.',
    color: '#77a990',
    privacySensitive: true,
  },
  money: {
    id: 'money',
    label: 'Money',
    description: 'Income, spending, bills, goals, debts, and balances.',
    color: '#d5aa59',
    privacySensitive: true,
  },
};

export type LifeEntityKind =
  | 'task'
  | 'event'
  | 'journal'
  | 'shift'
  | 'transaction'
  | 'person'
  | 'health-record'
  | 'goal';

export type LifeEntityRef = {
  kind: LifeEntityKind;
  id: string;
};

export type LifeEntityLinkType =
  | 'related'
  | 'created-from'
  | 'contributes-to'
  | 'reminds-about'
  | 'appears-in';

export type LifeEntityLink = {
  id: string;
  from: LifeEntityRef;
  to: LifeEntityRef;
  type: LifeEntityLinkType;
  createdAt: number;
};

export type LifeAreaRecord = {
  areaId?: LifeAreaId;
  links?: LifeEntityRef[];
};

export type TodayItemKind = 'task' | 'event' | 'reminder' | 'shift' | 'insight';

export type TodayItem = {
  id: string;
  kind: TodayItemKind;
  areaId?: LifeAreaId;
  title: string;
  detail?: string;
  startsAt?: string;
  priority: number;
  source: LifeEntityRef;
};

export function isLifeAreaId(value: unknown): value is LifeAreaId {
  return typeof value === 'string' && LIFE_AREA_IDS.includes(value as LifeAreaId);
}

export function getLifeArea(areaId?: LifeAreaId) {
  return areaId ? LIFE_AREAS[areaId] : undefined;
}

export function createLifeEntityLink(
  from: LifeEntityRef,
  to: LifeEntityRef,
  type: LifeEntityLinkType = 'related',
): LifeEntityLink {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `link-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return { id, from, to, type, createdAt: Date.now() };
}

export function linksForEntity(links: LifeEntityLink[], entity: LifeEntityRef) {
  return links.filter((link) =>
    (link.from.kind === entity.kind && link.from.id === entity.id)
    || (link.to.kind === entity.kind && link.to.id === entity.id));
}

export function sortTodayItems(items: TodayItem[]) {
  return [...items].sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return (a.startsAt ?? '99:99').localeCompare(b.startsAt ?? '99:99');
  });
}
