import { localStillRepository } from './localStillRepository';

// Supabase will implement the same StillRepository contract and replace this
// binding when authentication and remote sync are introduced.
export const stillRepository = localStillRepository;

export type {
  PermanentDataCache,
  PermanentDataSnapshot,
  RepositoryProvider,
  StillRepository,
  SyncMetadata,
} from './types';
