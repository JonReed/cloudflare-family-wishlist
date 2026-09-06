import type { FamilyWishlist } from '../../lib/db/wishlists';
import { useFetcher } from 'react-router';
import { useRef, useEffect } from 'react';
import { wishlistFormAction, ActionFields } from './form-fields';

export function ShareWishlistPanel({
  wishlist,
  linkCount,
  shareLinkName: initialShareLinkName,
  shareUrl: initialShareUrl
}: {
  wishlist: FamilyWishlist;
  linkCount: number;
  shareLinkName?: string;
  shareUrl?: string;
}) {
  const fetcher = useFetcher<{
    shareUrl?: string;
    shareLinkName?: string;
    error?: string;
  }>({ key: `share-wishlist:${wishlist.id}` });
  const panelRef = useRef<HTMLDetailsElement>(null);
  const handledResultRef = useRef(fetcher.data);
  const isPending = fetcher.state !== 'idle';
  const shareUrl = fetcher.data?.shareUrl ?? initialShareUrl;
  const shareLinkName = fetcher.data?.shareLinkName ?? initialShareLinkName;
  const error = !isPending ? fetcher.data?.error : undefined;
  const active = linkCount > 0;
  const atLimit = linkCount >= 5;

  useEffect(() => {
    const result = fetcher.data;
    if (fetcher.state !== 'idle' || !result || result === handledResultRef.current) return;
    handledResultRef.current = result;
    const panel = panelRef.current;
    if (!panel?.open) return;
    if (result.error) {
      panel.querySelector<HTMLElement>('.mutation-submit-error')?.focus({ preventScroll: true });
    } else if (result.shareUrl) {
      const input = panel.querySelector<HTMLInputElement>('[data-share-link]');
      input?.focus({ preventScroll: true });
      input?.select();
    }
  }, [fetcher.data, fetcher.state]);

  return (
    <details
      ref={panelRef}
      id="sharing"
      className="share-panel"
      open={Boolean(initialShareUrl)}
      data-share-panel
    >
      <summary>
        {active
          ? `${linkCount} sharing ${linkCount === 1 ? 'link' : 'links'} active`
          : 'Share this list'}
      </summary>
      <div className="share-panel-body">
        <a
          href={wishlistFormAction(wishlist.id)}
          className="share-panel-close"
          aria-label="Close sharing options"
          data-close-share-panel
        >
          <span aria-hidden="true">×</span>
        </a>
        <p>
          {active
            ? `${linkCount} active sharing ${linkCount === 1 ? 'link' : 'links'} out of 5. Anyone you send one to can see this wishlist.`
            : 'Make a sharing link for relatives and friends outside your family.'}
        </p>

        {shareUrl ? (
          <div key={shareUrl} className="share-link-result">
            {shareLinkName ? <p className="share-link-name">{shareLinkName} is ready.</p> : null}
            <label htmlFor={`share-link-${wishlist.id}`} className="form-label">
              Copy and share this link
            </label>
            <div className="share-link-copy">
              <input
                id={`share-link-${wishlist.id}`}
                className="form-control"
                value={shareUrl}
                readOnly
                data-share-link
              />
              <button type="button" className="button-secondary" data-copy-share-link>
                Copy link
              </button>
            </div>
            <p className="share-copy-status" role="status" aria-live="polite" />
          </div>
        ) : null}

        <p className="mutation-submit-status mutation-submit-error" role="alert" tabIndex={-1}>
          {error}
        </p>

        {atLimit ? (
          <div className="share-limit-message" role="status">
            <strong>You already have five sharing links for this wishlist.</strong>
            <p>
              To make another, first{' '}
              <a href="/profile#shared-lists">stop sharing one from Profile</a>.
            </p>
          </div>
        ) : (
          <>
            <fetcher.Form
              method="post"
              action={wishlistFormAction(wishlist.id)}
              className="share-link-form"
              aria-busy={isPending || undefined}
              onSubmit={(event) => {
                if (isPending) event.preventDefault();
              }}
            >
              <ActionFields wishlistId={wishlist.id} />
              <div>
                <label htmlFor={`share-link-name-${wishlist.id}`} className="form-label">
                  Who is this link for?
                </label>
                <input
                  id={`share-link-name-${wishlist.id}`}
                  name="shareLinkName"
                  disabled={isPending}
                  required
                  maxLength={80}
                  className="form-control"
                  placeholder="Uncle David"
                  aria-describedby={`share-link-name-hint-${wishlist.id}`}
                />
                <p id={`share-link-name-hint-${wishlist.id}`} className="share-link-hint">
                  This name is private and helps your family find the right link later.
                </p>
              </div>
              <button
                name="intent"
                value="create-share-link"
                className="button-secondary"
                disabled={isPending}
              >
                {isPending
                  ? 'Creating link…'
                  : active
                    ? 'Create another sharing link'
                    : 'Create sharing link'}
              </button>
            </fetcher.Form>
            {active ? (
              <p className="share-panel-manage">
                See or stop sharing existing links from <a href="/profile#shared-lists">Profile</a>.
              </p>
            ) : null}
          </>
        )}
      </div>
    </details>
  );
}
