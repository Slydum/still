import Dexie, { type Table } from 'dexie';

export type DailyQuoteRecord = {
  date: string;
  quoteId: string;
  createdAt: number;
};

export type CheckInRecord = {
  date: string;
  mood?: number;
  energy?: number;
  updatedAt: number;
};

class StillDatabase extends Dexie {
  dailyQuotes!: Table<DailyQuoteRecord, string>;
  checkIns!: Table<CheckInRecord, string>;

  constructor() {
    super('still-local');
    this.version(1).stores({
      dailyQuotes: 'date, quoteId, createdAt',
      checkIns: 'date, updatedAt',
    });
  }
}

export const stillDb = new StillDatabase();

export async function saveCheckIn(record: CheckInRecord) {
  await stillDb.checkIns.put(record);
}
