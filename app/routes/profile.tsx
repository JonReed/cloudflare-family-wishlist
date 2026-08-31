import { data, Form, useNavigation } from 'react-router';

import { Brand } from '../components/brand';
import { SiteFooter } from '../components/site-footer';
import { cloudflareContext, identityContext } from '../lib/context';
import { ensureMemberForEmail, MemberInputError, updateMemberDisplayName } from '../lib/db/members';

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
  const member = await ensureMemberForEmail(env.DB, identity.email);

  return { member };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const identity = context.get(identityContext);
  const member = await ensureMemberForEmail(env.DB, identity.email);
  const formData = await request.formData();

  try {
    await updateMemberDisplayName(env.DB, member.id, formData.get('displayName'));
    return { saved: true, error: null };
  } catch (error) {
    if (error instanceof MemberInputError) {
      return data({ saved: false, error: error.message }, { status: 400 });
    }

    throw error;
  }
}

export default function Profile({ loaderData, actionData }: Route.ComponentProps) {
  const { member } = loaderData;
  const [emailLocalPart, emailDomain] = member.email.split('@', 2);
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <div className="site-shell">
      <header className="site-header page-wrap">
        <a href="/" className="brand-link" aria-label="Family Wishlist home">
          <Brand />
        </a>

        <div className="account-links">
          <a href="/">Wishlists</a>
          <a href="/cdn-cgi/access/logout">Sign out</a>
        </div>
      </header>

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
              <p>
                Cloudflare Access manages this address. Your display name only changes what your
                family sees here.
              </p>
              <a href="/bookmarklet" className="button-quiet mt-5">
                Set up the browser button
              </a>
            </aside>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
