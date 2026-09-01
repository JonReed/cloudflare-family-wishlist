import { data, Form, redirect, useNavigation } from 'react-router';

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
  const member = await ensureMemberForEmail(
    env.DB,
    identity.email,
    organiserEmailForRequest(env, identity.email)
  );
  if (member.role !== 'admin') return redirect('/');

  return {
    member,
    people: await listFamilyPeople(env.DB),
    invitationUrl: new URL('/', request.url).toString(),
    added: new URL(request.url).searchParams.get('added') === '1',
    repaired: new URL(request.url).searchParams.get('repaired') === '1',
    removed: new URL(request.url).searchParams.get('removed') === '1'
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
  if (member.role !== 'admin') return redirect('/');
  const formData = await request.formData();
  const displayNameValue = formData.get('displayName');
  const emailValue = formData.get('email');
  const intent = formData.get('intent');

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
                ? 'Waiting to join'
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
        <Form method="post">
          <input type="hidden" name="intent" value="remove-member" />
          <input type="hidden" name="memberId" value={person.id} />
          <button type="submit" className="button-quiet">
            Remove access
          </button>
        </Form>
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
  const navigation = useNavigation();
  const isAdding = navigation.state === 'submitting';
  const joinedCount = loaderData.people.filter((person) => person.status === 'joined').length;
  const waitingCount = loaderData.people.length - joinedCount;

  return (
    <div className="site-shell">
      <SiteHeader member={loaderData.member} current="family" />

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
                <input type="hidden" name="intent" value="add-member" />
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
