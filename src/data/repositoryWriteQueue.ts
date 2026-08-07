type RepositoryWriteCallbacks = {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
};

let writeQueue: Promise<void> = Promise.resolve();
let latestFailure: unknown;

export function enqueueRepositoryWrite(
  write: () => Promise<void>,
  callbacks: RepositoryWriteCallbacks = {},
) {
  const execution = writeQueue.then(write);
  writeQueue = execution.then(
    () => {
      latestFailure = undefined;
      callbacks.onSuccess?.();
    },
    (error) => {
      latestFailure = error;
      callbacks.onError?.(error);
    },
  );
}

export async function flushRepositoryWrites() {
  await writeQueue;
  if (latestFailure !== undefined) throw latestFailure;
}
