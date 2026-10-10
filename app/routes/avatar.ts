import { cloudflareContext, identityContext, organiserEmailForRequest } from '../lib/context';
import {
  ensureMemberForEmail,
  findMemberAvatarIdentity,
  MemberAdmissionError
} from '../lib/db/members';
import { consumeAvatarBudget, AvatarRateLimitError } from '../lib/db/avatar-limits';
import { fetchGravatar, initialsAvatar } from '../lib/gravatar';

import type { Route } from './+types/avatar';

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const identity = context.get(identityContext);

  try {
    const viewer = await ensureMemberForEmail(
      env.DB,
      identity.email,
      organiserEmailForRequest(env, identity.email)
    );
    const member = await findMemberAvatarIdentity(env.DB, params.memberId);
    if (!member) return new Response('Picture not found.', { status: 404 });
    if (request.method === 'HEAD') {
      return new Response(null, { headers: { 'Content-Type': 'application/octet-stream' } });
    }

    try {
      await consumeAvatarBudget(env.DB, viewer.id);
    } catch (error) {
      if (error instanceof AvatarRateLimitError) return initialsAvatar(member.displayName);
      throw error;
    }
    return await fetchGravatar(member);
  } catch (error) {
    if (error instanceof MemberAdmissionError) {
      return new Response('This identity has not joined this family.', { status: 403 });
    }
    throw error;
  }
}
