import { AlertTriangle } from 'lucide-react';
import { usePersistenceStatus } from '../stores/usePersistenceStatus';

export function PersistenceStatusBanner() {
  const error = usePersistenceStatus((state) => state.error);
  if (!error) return null;

  return (
    <div className="persistence-status-banner" role="alert" aria-live="assertive">
      <AlertTriangle aria-hidden="true" size={18} />
      <span>
        <strong>Your latest change may not be saved.</strong>
        <small>{error} Keep Still open while you check available device storage, then make another change to retry.</small>
      </span>
    </div>
  );
}
