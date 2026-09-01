import { data, Form, redirect, useNavigation } from 'react-router';

import { Brand } from '../components/brand';
import { SiteFooter } from '../components/site-footer';
import {
  AccessManagementError,
  grantFamilyMemberAccess,
  revokeFamilyMemberAccess
} from '../lib/cloudflare/access-membership';
import { cloudflareContext, identityContext } from '../lib/context';
import {
  FamilyAdminRequiredError,
  FamilyMemberInputError,
  activateFamilyInvitation,
  beginFamilyInvitation,
  cancelPendingFamilyInvitation,
  listFamilyPeople,
  markFamilyInvitationForCleanup,
  type FamilyPerson
} from '../lib/db/family-members';
import { ensureMemberForEmail } from '../lib/db/members';

import type { Route } from './+types/family';

export function meta() {
  return [
    { title: 'Your family · Family Wishlist' },
    {
      name: 'description',
      content: 'See who has joined your private family wishlist and add someone new.'
    }
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const identity = context.get(identityContext);
  const member = await ensureMemberForEmail(env.DB, identity.email);
  if (member.role !== 'admin') return redirect('/');

  return {
    member,
    people: await listFamilyPeople(env.DB),
    invitationUrl: new URL('/', request.url).toString(),
    added: new URL(request.url).searchParams.get('added') === '1'
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const identity = context.get(identityContext);
  const member = await ensureMemberForEmail(env.DB, identity.email);
  if (member.role !== 'admin') return redirect('/');
  const formData = await request.formData();
  const displayNameValue = formData.get('displayName');
  const emailValue = formData.get('email');

  try {
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
  const date = formatFamilyDate(person.status === 'joined' ? person.joinedAt : person.invitedAt);

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
              : 'Waiting to join'}
          </span>
        </div>
        <p>{person.email}</p>
        {date ? (
          <small>
            {person.status === 'joined' ? 'Joined' : 'Added'} {date}
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
        </div>
      ) : null}
    </li>
  );
}

export default function Family({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isAdding = navigation.state === 'submitting';
  const joinedCount = loaderData.people.filter((person) => person.status === 'joined').length;
  const waitingCount = loaderData.people.length - joinedCount;

  return (
    <div className="site-shell">
      <header className="site-header page-wrap">
        <a href="/" className="brand-link" aria-label="Family Wishlist home">
          <Brand />
        </a>

        <div className="account-links">
          <a href="/">Wishlists</a>
          <a href="/bookmarklet">Add from anywhere</a>
          <a href="/profile">Profile</a>
          <a href="/cdn-cgi/access/logout">Sign out</a>
        </div>
      </header>

      <main className="profile-main page-wrap">
        <section className="profile-sheet family-sheet" aria-labelledby="family-title">
          <div className="profile-heading">
            <p className="profile-kicker">The people around your table</p>
            <h1 id="family-title">Your family</h1>
            <p>See who has made it in and add another favourite person when you’re ready.</p>
          </div>

          {loaderData.added ? (
            <div role="status" className="profile-saved family-page-message">
              They’re on the family list. Copy their invitation below and send it however you like.
            </div>
          ) : null}

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
                Use the exact email address they’ll enter on the sign-in page. We won’t email them;
                you’ll get an invitation to copy instead.
              </p>

              <Form method="post" className="profile-form family-add-form">
                {actionData?.error ? (
                  <div role="alert" className="form-alert profile-alert">
                    <strong>Sorry, that didn’t work.</strong> {actionData.error}
                  </div>
                ) : null}

                <div>
                  <label htmlFor="family-display-name" className="form-label">
                    Their name
                  </label>
                  <input
                    id="family-display-name"
                    name="displayName"
                    required
                    maxLength={80}
                    defaultValue={actionData?.values.displayName}
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
                    defaultValue={actionData?.values.email}
                    autoComplete="email"
                    className="form-control"
                    placeholder="name@example.com"
                  />
                  <p className="profile-hint">
                    For a child, an address such as yourname+child@gmail.com works nicely.
                  </p>
                </div>

                <button type="submit" className="button-primary" disabled={isAdding}>
                  {isAdding ? 'Adding…' : 'Add to the family'}
                </button>
              </Form>
            </aside>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
