import { stillRepository } from './repositories';

export { stillDb } from './localDb';
export type { CheckInRecord, DailyQuoteRecord } from './records';

export function saveCheckIn(record: import('./records').CheckInRecord) {
  return stillRepository.saveCheckIn(record);
}

export function listCheckIns() {
  return stillRepository.listCheckIns();
}

export function deleteCheckIn(date: string) {
  return stillRepository.deleteCheckIn(date);
}
