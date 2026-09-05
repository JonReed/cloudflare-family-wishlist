import { useEffect, useRef } from 'react';
import { useFetcher } from 'react-router';

export function StopSharingForm({
  shareLinkId,
  onRemovalStart,
  onRemovalError
}: {
  shareLinkId: string;
  onRemovalStart: (id: string) => void;
  onRemovalError: () => void;
}) {
  const fetcher = useFetcher<{ error?: string }>({ key: `stop-sharing:${shareLinkId}` });
  const markerRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const handledResultRef = useRef(fetcher.data);
  const isPending = fetcher.state !== 'idle';
  const error = !isPending ? fetcher.data?.error : undefined;

  useEffect(() => {
    if (fetcher.state !== 'idle' || fetcher.data === handledResultRef.current) return;
    handledResultRef.current = fetcher.data;
    if (fetcher.data?.error) {
      onRemovalError();
      errorRef.current?.focus({ preventScroll: true });
    }
  }, [fetcher.data, fetcher.state, onRemovalError]);

  return (
    <details className="removal-confirmation">
      <summary>Stop sharing this link</summary>
      <fetcher.Form
        method="post"
        action="/profile"
        aria-busy={isPending || undefined}
        onSubmit={(event) => {
          if (isPending) {
            event.preventDefault();
            return;
          }
          if (markerRef.current) markerRef.current.value = 'true';
          onRemovalStart(shareLinkId);
        }}
      >
        <p>This link will stop working for everyone who has it. Your wishlist will stay here.</p>
        <input type="hidden" name="intent" value="revoke-share-link" />
        <input type="hidden" name="shareLinkId" value={shareLinkId} />
        <input ref={markerRef} type="hidden" name="enhancedRemoval" defaultValue="false" />
        <button type="submit" className="button-danger" disabled={isPending}>
          {isPending ? 'Stopping sharing…' : 'Yes, stop sharing this link'}
        </button>
        <p
          ref={errorRef}
          className="mutation-submit-status mutation-submit-error"
          role="alert"
          tabIndex={-1}
        >
          {error}
        </p>
      </fetcher.Form>
    </details>
  );
}
