import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Returns to the route the user actually came from when browser history exists,
 * with an explicit in-app fallback for direct links and restored sessions.
 */
export function useBackNavigation(fallback: string) {
  const navigate = useNavigate();

  return useCallback(() => {
    const historyIndex = typeof window !== 'undefined'
      ? Number(window.history.state?.idx ?? 0)
      : 0;

    if (historyIndex > 0) {
      navigate(-1);
      return;
    }

    navigate(fallback, { replace: true });
  }, [fallback, navigate]);
}
