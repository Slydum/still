export type DailyQuoteRecord = {
  date: string;
  quoteId: string;
  createdAt: number;
};

export type CheckInRecord = {
  date: string;
  mood?: number;
  energy?: number;
  sleepHours?: number;
  hydrationCups?: number;
  movementMinutes?: number;
  answerSnapshot?: string;
  scaleVersion?: number;
  updatedAt: number;
};
