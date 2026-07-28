import { useEffect, useMemo, useState } from 'react';
import { stillDb } from '../data/stillDb';
import { quoteById, selectQuote } from '../content/quoteEngine';
import type { StillQuote } from '../content/stillQuotes';
import type { StillContext } from '../theme/stillContext';

export function useDailyQuote(context: StillContext) {
  const fallback = useMemo(
    () => selectQuote(context, [], `${context.dateKey}:fallback`),
    [context.dateKey],
  );
  const [quote, setQuote] = useState<StillQuote>(fallback);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadDailyQuote() {
      try {
        const existing = await stillDb.dailyQuotes.get(context.dateKey);
        const storedQuote = existing ? quoteById.get(existing.quoteId) : undefined;

        if (storedQuote) {
          if (active) setQuote(storedQuote);
          return;
        }

        const recentRecords = await stillDb.dailyQuotes
          .orderBy('createdAt')
          .reverse()
          .limit(30)
          .toArray();

        const selected = selectQuote(
          context,
          recentRecords.map((record) => record.quoteId),
          context.dateKey,
        );

        await stillDb.dailyQuotes.put({
          date: context.dateKey,
          quoteId: selected.id,
          createdAt: Date.now(),
        });

        if (active) setQuote(selected);
      } catch {
        if (active) setQuote(fallback);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadDailyQuote();
    return () => {
      active = false;
    };
  }, [context.dateKey, fallback]);

  return { quote, isLoading };
}
