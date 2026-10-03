import { useCallback, useEffect, useRef } from 'react';
import { useFetcher } from 'react-router';

import type { ActiveFamilyShareLink, ShareableWishlist } from '../lib/db/shared-wishlists';
import { StopSharingForm } from './stop-sharing-form';

type FamilyShareResult = {
  shareUrl?: string;
  shareLinkId?: string;
  shareLinkName?: string;
  familyShareError?: string;
  selectedWishlistIds?: string[];
};

export function FamilySharing({
  wishlists,
  links,
  serverResult,
  initialSelectedWishlistIds = []
}: {
  wishlists: ShareableWishlist[];
  links: ActiveFamilyShareLink[];
  serverResult?: FamilyShareResult;
  initialSelectedWishlistIds?: string[];
}) {
  const fetcher = useFetcher<FamilyShareResult>({ key: 'share-family-wishlists' });
  const sectionRef = useRef<HTMLElement>(null);
  const handledResultRef = useRef(fetcher.data);
  const removalRef = useRef<{ id: string; candidates: string[] } | null>(null);
  const isPending = fetcher.state !== 'idle';
  const result = fetcher.data ?? serverResult;
  const shareUrl =
    result?.shareLinkId && links.some((link) => link.id === result.shareLinkId)
      ? result.shareUrl
      : undefined;
  const error = !isPending ? result?.familyShareError : undefined;
  const atLimit = links.length >= 5;

  useEffect(() => {
    if (fetcher.state !== 'idle' || fetcher.data === handledResultRef.current) return;
    handledResultRef.current = fetcher.data;
    if (fetcher.data?.familyShareError) {
      sectionRef.current
        ?.querySelector<HTMLElement>('.family-share-error')
        ?.focus({ preventScroll: true });
    } else if (fetcher.data?.shareUrl) {
      const input = sectionRef.current?.querySelector<HTMLInputElement>('[data-share-link]');
      input?.focus({ preventScroll: true });
      input?.select();
    }
  }, [fetcher.data, fetcher.state]);

  const handleRemovalStart = (id: string) => {
    const ids = links.map((link) => link.id);
    const index = ids.indexOf(id);
    removalRef.current = {
      id,
      candidates: [...ids.slice(index + 1), ...ids.slice(0, index).reverse()]
    };
  };
  const handleRemovalError = useCallback(() => {
    removalRef.current = null;
  }, []);

  useEffect(() => {
    const removal = removalRef.current;
    if (!removal || links.some((link) => link.id === removal.id)) return;
    removalRef.current = null;
    if (document.activeElement !== document.body) return;
    const nextId = removal.candidates.find((id) => links.some((link) => link.id === id));
    const target = nextId
      ? sectionRef.current?.querySelector<HTMLElement>(`[data-share-id="${nextId}"] summary`)
      : sectionRef.current?.querySelector<HTMLElement>('.profile-shares-empty');
    target?.focus({ preventScroll: true });
  }, [links]);

  return (
    <section
      ref={sectionRef}
      className="profile-shares family-sharing"
      id="family-sharing"
      aria-labelledby="family-sharing-title"
      tabIndex={-1}
    >
      <div className="profile-shares-heading">
        <p className="profile-kicker">Gift ideas for relatives and friends</p>
        <h2 id="family-sharing-title">Sharing links</h2>
        <p>
          Choose one or more lists to include in a link. Anyone with the link can see their current
          wishes without signing in.
        </p>
      </div>

      {shareUrl ? (
        <div key={shareUrl} className="share-link-result family-share-result">
          <p className="share-link-name">{result?.shareLinkName} is ready.</p>
          <label htmlFor="family-share-url" className="form-label">
            Copy and share this link
          </label>
          <div className="share-link-copy">
            <input
              id="family-share-url"
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

      <p
        className="mutation-submit-status mutation-submit-error family-share-error"
        role="alert"
        tabIndex={-1}
      >
        {error}
      </p>

      {atLimit ? (
        <p className="profile-shares-note">
          Your family has reached the five-link allowance. Stop sharing links below until fewer than
          five remain before making another.
        </p>
      ) : (
        <fetcher.Form
          method="post"
          action="/family"
          className="family-sharing-form"
          aria-busy={isPending || undefined}
          onSubmit={(event) => {
            if (isPending) event.preventDefault();
          }}
        >
          <input type="hidden" name="intent" value="create-family-share-link" />
          <fieldset disabled={isPending} className="family-sharing-fields">
            <legend className="form-label">Which wishlists would you like to share?</legend>
            <div className="family-share-choices">
              {wishlists.map((wishlist) => (
                <label key={wishlist.id}>
                  <input
                    type="checkbox"
                    name="wishlistIds"
                    value={wishlist.id}
                    defaultChecked={(
                      serverResult?.selectedWishlistIds ?? initialSelectedWishlistIds
                    ).includes(wishlist.id)}
                  />
                  <span>{wishlist.ownerDisplayName}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="family-share-name">
            <label htmlFor="family-share-name" className="form-label">
              Who is this link for?
            </label>
            <input
              id="family-share-name"
              name="shareLinkName"
              className="form-control"
              required
              maxLength={80}
              placeholder="Uncle David"
              defaultValue={serverResult?.shareLinkName}
              disabled={isPending}
              aria-describedby="family-share-name-hint"
            />
            <p id="family-share-name-hint" className="profile-hint">
              This name is private and helps you recognise the link later.
            </p>
          </div>
          <button
            type="submit"
            className="button-secondary"
            disabled={isPending || !wishlists.length}
          >
            {isPending ? 'Creating link…' : 'Create sharing link'}
          </button>
        </fetcher.Form>
      )}

      {links.length ? (
        <ul className="profile-share-list">
          {links.map((link) => (
            <li key={link.id} className="profile-share-item" data-share-id={link.id}>
              <div>
                <h3>{link.name}</h3>
                <p>
                  Visible wishlists:{' '}
                  {link.wishlists.map((wishlist) => wishlist.ownerDisplayName).join(', ') ||
                    'No wishlists currently visible'}
                </p>
                <p>
                  Made by {link.createdByDisplayName} on{' '}
                  <time dateTime={link.createdAt}>
                    {new Intl.DateTimeFormat('en-GB', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: 'Europe/London'
                    }).format(new Date(link.createdAt))}
                  </time>
                </p>
              </div>
              <div className="profile-share-actions">
                <StopSharingForm
                  shareLinkId={link.id}
                  action="/family"
                  intent="revoke-share-link"
                  onRemovalStart={handleRemovalStart}
                  onRemovalError={handleRemovalError}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="profile-shares-empty" tabIndex={-1}>
          No sharing links are active.
        </p>
      )}
      <p className="profile-shares-note">
        Your family can have up to five active sharing links. An address is shown only when it is
        made. You can review and stop sharing every link here at any time.
      </p>
    </section>
  );
}
