import { data, Form, redirect } from 'react-router';

import { AddFamilyMemberForm } from '../components/add-family-member-form';
import { FamilyMemberRemoval } from '../components/family-member-removal';
import { FamilySharing } from '../components/family-sharing';
import { SiteFooter } from '../components/site-footer';
import { SiteHeader } from '../components/site-header';
import {
  AccessManagementError,
  ensureFamilyMemberAccess,
  grantFamilyMemberAccess,
  revokeFamilyAccessSessions,
  revokeFamilyMemberAccess
} from '../lib/cloudflare/access-membership';
import { cloudflareContext, identityContext, organiserEmailForRequest } from '../lib/context';
import {
  FamilyAdminRequiredError,
  FamilyMemberInputError,
  activateFamilyInvitation,
  beginFamilyInvitation,
  cancelPendingFamilyInvitation,
  completeFamilyMemberRemoval,
  getFamilyInvitationForRepair,
  listFamilyPeople,
  markFamilyInvitationForCleanup,
  prepareFamilyMemberRemoval,
  type FamilyPerson
} from '../lib/db/family-members';
import { ensureMemberForEmail } from '../lib/db/members';
import {
  ensurePublicSharingAccess,
  PublicSharingAccessError
} from '../lib/cloudflare/access-public-sharing';
import {
  createFamilyShareLink,
  listActiveShareLinks,
  listShareableWishlists,
  normaliseSharedWishlistIds,
  normaliseWishlistShareLinkName,
  revokeShareLink,
  SharedWishlistInputError
} from '../lib/db/shared-wishlists';

import type { Route } from './+types/family';

export function meta() {
  return [
    { title: 'Manage · Family Wishlist' },
    {
      name: 'description',
      content: 'Share family wishlists and manage your family space.'
    }
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const identity = context.get(identityContext);
  const member = await ensureMemberForEmail(
    env.DB,
    identity.email,
    organiserEmailForRequest(env, identity.email)
  );
  const url = new URL(request.url);
  const isOrganiser = member.role === 'admin';
  const shareableWishlists = await listShareableWishlists(env.DB, member.id);
  const requestedWishlistId = url.searchParams.get('list');
  return {
    member,
    people: isOrganiser ? await listFamilyPeople(env.DB) : [],
    shareableWishlists,
    shareLinks: await listActiveShareLinks(env.DB, member.id),
    initialSelectedWishlistIds: shareableWishlists
      .filter((wishlist) => wishlist.id === requestedWishlistId)
      .map((wishlist) => wishlist.id),
    invitationUrl: new URL('/', request.url).toString(),
    added: isOrganiser && url.searchParams.get('added') === '1',
    repaired: isOrganiser && url.searchParams.get('repaired') === '1',
    removed: isOrganiser && url.searchParams.get('removed') === '1'
  };
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
  const displayNameValue = formData.get('displayName');
  const emailValue = formData.get('email');
  const intent = formData.get('intent');

  if (
    intent === 'create-family-share-link' ||
    intent === 'revoke-share-link' ||
    intent === 'revoke-family-share-link'
  ) {
    try {
      if (intent !== 'create-family-share-link') {
        const shareLinkId = formData.get('shareLinkId');
        await revokeShareLink(env.DB, member.id, shareLinkId);
        if (formData.get('enhancedRemoval') === 'true') return { removedShareLinkId: shareLinkId };
        return redirect('/family#family-sharing');
      }
      const wishlistIds = normaliseSharedWishlistIds(formData.getAll('wishlistIds'));
      const shareLinkName = normaliseWishlistShareLinkName(formData.get('shareLinkName'));
      if (!import.meta.env.DEV) {
        await ensurePublicSharingAccess(env, new URL(request.url).hostname);
      }
      const { token, shareLinkId } = await createFamilyShareLink(
        env.DB,
        member.id,
        wishlistIds,
        shareLinkName
      );
      return {
        shareUrl: new URL(`/shared/${token}`, request.url).toString(),
        shareLinkId,
        shareLinkName
      };
    } catch (error) {
      if (error instanceof SharedWishlistInputError || error instanceof PublicSharingAccessError) {
        const shareLinkName = formData.get('shareLinkName');
        // Revocation errors use the same shape as the reusable stop-sharing fetcher.
        if (intent !== 'create-family-share-link')
          return data({ error: error.message, familyShareError: error.message }, { status: 400 });
        return data(
          {
            error: error.message,
            familyShareError: error.message,
            shareLinkName: typeof shareLinkName === 'string' ? shareLinkName.slice(0, 80) : '',
            selectedWishlistIds: formData
              .getAll('wishlistIds')
              .filter((id): id is string => typeof id === 'string')
              .slice(0, 50)
          },
          { status: 400 }
        );
      }
      throw error;
    }
  }

  if (member.role !== 'admin') return redirect('/');

  try {
    if (intent === 'repair-invitation') {
      const invitationId = formData.get('invitationId');
      if (typeof invitationId !== 'string') {
        throw new FamilyMemberInputError('Choose an invitation to repair.');
      }
      const invitation = await getFamilyInvitationForRepair(env.DB, member.id, invitationId);
      const accessPolicyId = await ensureFamilyMemberAccess(
        env,
        invitation.id,
        invitation.email,
        invitation.accessPolicyId
      );
      await activateFamilyInvitation(env.DB, invitation.id, accessPolicyId);
      return redirect('/family?repaired=1');
    }

    if (intent === 'remove-member') {
      const memberId = formData.get('memberId');
      if (typeof memberId !== 'string') {
        throw new FamilyMemberInputError('Choose a family member to remove.');
      }
      const removal = await prepareFamilyMemberRemoval(env.DB, member.id, memberId);
      await revokeFamilyMemberAccess(env, removal.accessPolicyId);
      await revokeFamilyAccessSessions(env);
      await completeFamilyMemberRemoval(env.DB, removal.memberId);
      return redirect('/family?removed=1');
    }

    const invitation = await beginFamilyInvitation(env.DB, member.id, {
      displayName: displayNameValue,
      email: emailValue
    });

    let accessPolicyId: string;
    try {
      accessPolicyId = await grantFamilyMemberAccess(env, invitation.id, invitation.email);
    } catch (error) {
      try {
        await cancelPendingFamilyInvitation(env.DB, invitation.id);
      } catch {
        console.error(
          JSON.stringify({
            event: 'family_invitation_pending_cleanup_failed',
            invitationId: invitation.id
          })
        );
      }
      throw error;
    }

    try {
      await activateFamilyInvitation(env.DB, invitation.id, accessPolicyId);
    } catch (error) {
      let revoked = false;
      try {
        await revokeFamilyMemberAccess(env, accessPolicyId);
        revoked = true;
      } catch {
        try {
          await markFamilyInvitationForCleanup(env.DB, invitation.id, accessPolicyId);
        } catch {
          console.error(
            JSON.stringify({
              event: 'family_invitation_cleanup_state_failed',
              invitationId: invitation.id
            })
          );
        }
      }

      if (revoked) {
        try {
          await cancelPendingFamilyInvitation(env.DB, invitation.id);
        } catch {
          console.error(
            JSON.stringify({
              event: 'family_invitation_pending_cleanup_failed',
              invitationId: invitation.id
            })
          );
        }
      }

      throw error;
    }

    if (formData.get('enhancedAddMember') === 'true') {
      return { added: true as const };
    }

    return redirect('/family?added=1');
  } catch (error) {
    if (error instanceof FamilyAdminRequiredError) {
      return data(
        {
          error: error.message,
          values: {
            displayName: typeof displayNameValue === 'string' ? displayNameValue.slice(0, 80) : '',
            email: typeof emailValue === 'string' ? emailValue.slice(0, 254) : ''
          }
        },
        { status: 403 }
      );
    }

    if (error instanceof FamilyMemberInputError || error instanceof AccessManagementError) {
      return data(
        {
          error: error.message,
          values: {
            displayName: typeof displayNameValue === 'string' ? displayNameValue.slice(0, 80) : '',
            email: typeof emailValue === 'string' ? emailValue.slice(0, 254) : ''
          }
        },
        {
          status:
            error instanceof AccessManagementError && error.code === 'not_configured' ? 503 : 400
        }
      );
    }

    throw error;
  }
}

function formatFamilyDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

function FamilyPersonRow({
  person,
  invitationUrl
}: {
  person: FamilyPerson;
  invitationUrl: string;
}) {
  const date = formatFamilyDate(
    person.status === 'joined' || person.status === 'removing' ? person.joinedAt : person.invitedAt
  );

  return (
    <li className="family-person">
      <span className="family-person-initial" aria-hidden="true">
        {person.displayName.charAt(0).toUpperCase() || '•'}
      </span>

      <div className="family-person-details">
        <div className="family-person-heading">
          <h3>{person.displayName}</h3>
          <span className={`family-person-status family-person-status-${person.status}`}>
            {person.status === 'joined'
              ? person.role === 'admin'
                ? 'Family organiser'
                : 'Joined'
              : person.status === 'waiting'
                ? 'Not signed in yet'
                : person.status === 'attention'
                  ? 'Invitation needs attention'
                  : 'Removal needs attention'}
          </span>
        </div>
        <p>{person.email}</p>
        {date ? (
          <small>
            {person.status === 'joined' || person.status === 'removing' ? 'Joined' : 'Added'} {date}
          </small>
        ) : null}
      </div>

      {person.status === 'waiting' ? (
        <div className="family-invite-copy">
          <button
            type="button"
            className="button-quiet"
            data-copy-family-invitation
            data-invitation-url={invitationUrl}
            data-invitation-email={person.email}
          >
            Copy invitation
          </button>
          <span className="family-copy-status" role="status" aria-live="polite" />
          {person.memberId ? (
            <FamilyMemberRemoval displayName={person.displayName} memberId={person.memberId} />
          ) : null}
        </div>
      ) : null}

      {person.status === 'attention' ? (
        <Form method="post">
          <input type="hidden" name="intent" value="repair-invitation" />
          <input type="hidden" name="invitationId" value={person.id} />
          <button type="submit" className="button-quiet">
            Repair invitation
          </button>
        </Form>
      ) : null}

      {person.status === 'joined' && person.role === 'member' ? (
        <FamilyMemberRemoval displayName={person.displayName} memberId={person.id} />
      ) : null}

      {person.status === 'removing' ? (
        <Form method="post">
          <input type="hidden" name="intent" value="remove-member" />
          <input type="hidden" name="memberId" value={person.id} />
          <button type="submit" className="button-quiet">
            Finish removal
          </button>
        </Form>
      ) : null}
    </li>
  );
}

export default function Family({ loaderData, actionData }: Route.ComponentProps) {
  const joinedCount = loaderData.people.filter((person) => person.status === 'joined').length;
  const waitingCount = loaderData.people.length - joinedCount;
  const navigationError =
    actionData && 'error' in actionData && !('familyShareError' in actionData)
      ? actionData.error
      : null;
  const submittedValues = actionData && 'values' in actionData ? actionData.values : undefined;

  return (
    <div className="site-shell">
      <SiteHeader member={loaderData.member} current="family" />

      <main className="profile-main page-wrap">
        <section className="profile-sheet family-sheet" aria-labelledby="family-title">
          <div className="profile-heading">
            <p className="profile-kicker">
              {loaderData.member.role === 'admin'
                ? 'Sharing and family settings'
                : 'Sharing settings'}
            </p>
            <h1 id="family-title">Manage</h1>
            <p>
              Share gift ideas with relatives and friends.
              {loaderData.member.role === 'admin'
                ? ' You can also welcome someone new to your family space.'
                : ''}
            </p>
          </div>

          {loaderData.repaired ? (
            <div role="status" className="profile-saved family-page-message">
              Their invitation is ready again.
            </div>
          ) : null}

          {loaderData.removed ? (
            <div role="status" className="profile-saved family-page-message">
              Their access has been removed. Everyone was signed out so the change takes effect.
            </div>
          ) : null}

          {loaderData.member.role === 'admin' ? (
            <div className="family-admin-grid">
              <section aria-labelledby="family-members-title">
                <div className="family-section-heading">
                  <h2 id="family-members-title">Family members</h2>
                  <p>
                    {joinedCount} joined{waitingCount ? ` · ${waitingCount} waiting` : ''}
                  </p>
                </div>

                <ul className="family-people-list">
                  {loaderData.people.map((person) => (
                    <FamilyPersonRow
                      key={`${person.status}-${person.id}`}
                      person={person}
                      invitationUrl={loaderData.invitationUrl}
                    />
                  ))}
                </ul>
              </section>

              <aside className="family-add-panel" aria-labelledby="add-family-member-title">
                <span aria-hidden="true" className="add-panel-tape" />
                <h2 id="add-family-member-title">Add someone</h2>
                <p>
                  Their wishlist will be ready straight away, even before they sign in. Use the
                  exact email address they’ll sign in with. We won’t email them; you’ll get an
                  invitation to copy instead.
                </p>

                <AddFamilyMemberForm
                  method="post"
                  className="profile-form family-add-form"
                  serverSucceeded={loaderData.added}
                >
                  {({ error, isPending, succeeded }) => (
                    <>
                      <input type="hidden" name="intent" value="add-member" />
                      {(error ?? navigationError) ? (
                        <div role="alert" className="form-alert profile-alert">
                          <strong>Sorry, that didn’t work.</strong> {error ?? navigationError}
                        </div>
                      ) : null}

                      <fieldset className="family-add-fields" disabled={isPending}>
                        <div>
                          <label htmlFor="family-display-name" className="form-label">
                            Their name
                          </label>
                          <input
                            id="family-display-name"
                            name="displayName"
                            required
                            maxLength={80}
                            defaultValue={submittedValues?.displayName}
                            autoComplete="off"
                            className="form-control"
                            placeholder="The name your family uses"
                          />
                        </div>

                        <div>
                          <label htmlFor="family-email" className="form-label">
                            Sign-in email
                          </label>
                          <input
                            id="family-email"
                            name="email"
                            type="email"
                            required
                            maxLength={254}
                            defaultValue={submittedValues?.email}
                            autoComplete="email"
                            className="form-control"
                            placeholder="name@example.com"
                          />
                          <p className="profile-hint">
                            For a child, an address such as yourname+child@gmail.com works nicely.
                          </p>
                        </div>

                        <button type="submit" className="button-primary">
                          {isPending ? 'Adding…' : 'Add to the family'}
                        </button>
                      </fieldset>

                      <div
                        role="status"
                        aria-live="polite"
                        className="profile-saved family-add-success"
                        hidden={!succeeded}
                      >
                        Added to your family. Their wishlist is ready for wishes. Copy their
                        invitation from the family list and send it however you like.
                      </div>
                    </>
                  )}
                </AddFamilyMemberForm>
              </aside>
            </div>
          ) : null}
          <FamilySharing
            wishlists={loaderData.shareableWishlists}
            links={loaderData.shareLinks}
            initialSelectedWishlistIds={loaderData.initialSelectedWishlistIds}
            serverResult={
              actionData && ('shareUrl' in actionData || 'familyShareError' in actionData)
                ? actionData
                : undefined
            }
          />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
