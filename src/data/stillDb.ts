import Dexie, { type Table } from 'dexie';
import {
  CHECK_IN_SCALE_VERSION,
  createCheckInSnapshot,
} from '../features/check-ins/checkInScale';

export type DailyQuoteRecord = {
  date: string;
  quoteId: string;
  createdAt: number;
};

export type CheckInRecord = {
  date: string;
  mood?: number;
  energy?: number;
  answerSnapshot?: string;
  scaleVersion?: number;
  updatedAt: number;
};

function withCheckInSnapshot(record: CheckInRecord): CheckInRecord {
  const snapshot = createCheckInSnapshot(record.mood, record.energy);
  if (!snapshot.answerSnapshot) return record;

  return {
    ...record,
    answerSnapshot: snapshot.answerSnapshot,
    scaleVersion: CHECK_IN_SCALE_VERSION,
  };
}

class StillDatabase extends Dexie {
  dailyQuotes!: Table<DailyQuoteRecord, string>;
  checkIns!: Table<CheckInRecord, string>;

  constructor() {
    super('still-local');
    this.version(1).stores({
      dailyQuotes: 'date, quoteId, createdAt',
      checkIns: 'date, updatedAt',
    });
    this.version(2).stores({
      dailyQuotes: 'date, quoteId, createdAt',
      checkIns: 'date, updatedAt, scaleVersion',
    }).upgrade(async (transaction) => {
      await transaction.table<CheckInRecord>('checkIns').toCollection().modify((record) => {
        const migrated = withCheckInSnapshot(record);
        record.answerSnapshot = migrated.answerSnapshot;
        record.scaleVersion = migrated.scaleVersion;
      });
    });
  }
}

export const stillDb = new StillDatabase();

export async function saveCheckIn(record: CheckInRecord) {
  await stillDb.checkIns.put(withCheckInSnapshot(record));
}

export async function listCheckIns() {
  return stillDb.checkIns.orderBy('date').reverse().toArray();
}

export async function deleteCheckIn(date: string) {
  await stillDb.checkIns.delete(date);
}
