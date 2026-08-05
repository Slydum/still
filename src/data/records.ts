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
