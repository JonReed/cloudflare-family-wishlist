import { useCallback, useEffect, useRef } from 'react';
import { data, Form, redirect, useNavigation } from 'react-router';

import { AccessSignOut } from '../components/access-sign-out';
import { SiteFooter } from '../components/site-footer';
import { SiteHeader } from '../components/site-header';
import { StopSharingForm } from '../components/stop-sharing-form';
import { cloudflareContext, identityContext, organiserEmailForRequest } from '../lib/context';
import { ensureMemberForEmail, MemberInputError, updateMemberDisplayName } from '../lib/db/members';
import {
  listActiveWishlistShareLinks,
  revokeWishlistShareLink,
  SharedWishlistInputError
} from '../lib/db/shared-wishlists';

import type { Route } from './+types/profile';

export function meta() {
  return [
    { title: 'Your profile · Family Wishlist' },
    {
      name: 'description',
      content: 'Choose the name your family sees on Family Wishlist.'
    }
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const identity = context.get(identityContext);
  const member = await ensureMemberForEmail(
    env.DB,
    identity.email,
    organiserEmailForRequest(env, identity.email)
  );

  const sharedLists = await listActiveWishlistShareLinks(env.DB, member.id);

  return { member, sharedLists };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const identity = context.get(identityContext);
  const member = await ensureMemberForEmail(
    env.DB,
    identity.email,
    organiserEmailForRequest(env, identity.email)
  );
  const formData = await request.formData();

  try {
    const intent = formData.get('intent');
    if (intent === 'save-profile') {
      await updateMemberDisplayName(env.DB, member.id, formData.get('displayName'));
      return { saved: true, error: null };
    }

    if (intent === 'revoke-share-link') {
      const shareLinkId = formData.get('shareLinkId');
      if (typeof shareLinkId !== 'string') {
        throw new SharedWishlistInputError('This page is out of date. Refresh it and try again.');
      }
      await revokeWishlistShareLink(env.DB, member.id, shareLinkId);
      if (formData.get('enhancedRemoval') === 'true') {
        return { saved: false, error: null, removedShareLinkId: shareLinkId };
      }
      return redirect('/profile#shared-lists');
    }

    throw new MemberInputError('This page is out of date. Refresh it and try again.');
  } catch (error) {
    if (error instanceof MemberInputError || error instanceof SharedWishlistInputError) {
      return data({ saved: false, error: error.message }, { status: 400 });
    }

    throw error;
  }
}

export default function Profile({ loaderData, actionData }: Route.ComponentProps) {
  const { member, sharedLists } = loaderData;
  const [emailLocalPart, emailDomain] = member.email.split('@', 2);
  const navigation = useNavigation();
  const pendingIntent = navigation.formData?.get('intent');
  const isSaving = navigation.state === 'submitting' && pendingIntent === 'save-profile';
  const sharesRef = useRef<HTMLElement>(null);
  const removalRef = useRef<{ id: string; candidates: string[] } | null>(null);
  const handleRemovalStart = (id: string) => {
    const ids = sharedLists.map((link) => link.id);
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
    const shares = sharesRef.current;
    if (!removal || !shares || sharedLists.some((link) => link.id === removal.id)) return;
    removalRef.current = null;
    if (document.activeElement !== document.body) return;
    const nextId = removal.candidates.find((id) => sharedLists.some((link) => link.id === id));
    const target = nextId
      ? shares.querySelector<HTMLElement>(`[data-share-id="${nextId}"] button`)
      : (shares.querySelector<HTMLElement>('.profile-shares-empty') ??
        shares.querySelector<HTMLElement>('#shared-lists-title'));
    target?.focus({ preventScroll: true });
  }, [sharedLists]);

  return (
    <div className="site-shell">
      <SiteHeader member={member} current="profile" />

      <main className="profile-main page-wrap">
        <section className="profile-sheet" aria-labelledby="profile-title">
          <div className="profile-heading">
            <p className="profile-kicker">Your details</p>
            <h1 id="profile-title">Your profile</h1>
            <p>
              Choose the name your family will see on your wishlist and around the family space.
            </p>
          </div>

          <div className="profile-grid">
            <Form method="post" className="profile-form">
              <input type="hidden" name="intent" value="save-profile" />
              {actionData?.error ? (
                <div role="alert" className="form-alert profile-alert">
                  <strong>Sorry, that didn’t work.</strong> {actionData.error}
                </div>
              ) : null}

              {actionData?.saved ? (
                <div role="status" className="profile-saved">
                  Saved — your family will see the new name now.
                </div>
              ) : null}

              <div>
                <label htmlFor="display-name" className="form-label">
                  Display name
                </label>
                <input
                  id="display-name"
                  name="displayName"
                  required
                  maxLength={80}
                  defaultValue={member.displayName}
                  autoComplete="name"
                  className="form-control"
                  aria-describedby="display-name-hint"
                />
                <p id="display-name-hint" className="profile-hint">
                  Use the name your family knows you by.
                </p>
              </div>

              <button type="submit" className="button-primary" disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Save profile'}
              </button>
            </Form>

            <aside className="profile-identity" aria-label="Sign-in details">
              <p className="profile-identity-label">Signed in as</p>
              <p className="profile-email">
                {emailLocalPart}
                {emailDomain ? (
                  <>
                    <wbr />@{emailDomain}
                  </>
                ) : null}
              </p>
              <AccessSignOut email={member.email} />
            </aside>
          </div>

          <section
            ref={sharesRef}
            className="profile-shares"
            id="shared-lists"
            aria-labelledby="shared-lists-title"
          >
            <div className="profile-shares-heading">
              <p className="profile-kicker">Shared outside your family</p>
              <h2 id="shared-lists-title" tabIndex={-1}>
                Sharing links
              </h2>
              <p>
                Each wishlist can have up to five active sharing links. Anyone with one of those
                links can see the list without signing in.
              </p>
            </div>

            {sharedLists.length > 0 ? (
              <ul className="profile-share-list">
                {sharedLists.map((sharedList) => (
                  <li
                    key={sharedList.id}
                    className="profile-share-item"
                    data-share-id={sharedList.id}
                  >
                    <div>
                      <h3>{sharedList.name}</h3>
                      <p>
                        For {sharedList.ownerDisplayName}’s wishlist · Made by{' '}
                        {sharedList.createdByDisplayName} on{' '}
                        <time dateTime={sharedList.createdAt}>
                          {new Intl.DateTimeFormat('en-GB', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                            timeZone: 'Europe/London'
                          }).format(new Date(sharedList.createdAt))}
                        </time>
                      </p>
                    </div>
                    <div className="profile-share-actions">
                      <a
                        href={`/?list=${encodeURIComponent(sharedList.wishlistId)}#wishlist`}
                        className="button-quiet"
                      >
                        View wishlist
                      </a>
                      <StopSharingForm
                        shareLinkId={sharedList.id}
                        onRemovalStart={handleRemovalStart}
                        onRemovalError={handleRemovalError}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="profile-shares-empty" tabIndex={-1}>
                No wishlists are currently shared outside your family.
              </p>
            )}

            <p className="profile-shares-note">
              For safety, an address is shown only when it is made. View the wishlist to create and
              copy a new one when there is space.
            </p>
          </section>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
