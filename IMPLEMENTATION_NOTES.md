# Still. theme-engine implementation

## Runtime flow

1. `stillContext.ts` creates a local context from time, mood, energy, optional weather, and occasion.
2. `quoteEngine.ts` scores the 150 quotes against that context.
3. `useDailyQuote.ts` stores one stable quote per local date in IndexedDB and avoids the previous 30 quote IDs.
4. `themeEngine.ts` selects matching companion, time/weather, plant, check-in, and priority illustrations.
5. `DashboardPage.tsx` renders the resulting theme while keeping the dashboard layout stable.

## Asset paths

All production illustrations are served from:

```text
/public/assets/illustrations/<category>/<filename>.webp
```

The central path registry is `src/theme/stillAssets.ts`. Components should use that registry rather than hard-coded file paths.

## Weather

Weather is manually selectable in v1 so the app remains free and backend-free. A future weather provider only needs to call `setWeather()` with a supported `WeatherKey`; no dashboard redesign is required.
