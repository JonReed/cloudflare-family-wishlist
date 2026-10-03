import { createExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { RouterContextProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ensurePublicSharingAccess,
  PublicSharingAccessError
} from '../app/lib/cloudflare/access-public-sharing';
import { cloudflareContext, identityContext } from '../app/lib/context';
import { ensureMemberForEmail } from '../app/lib/db/members';
import {
  createWishlistShareLink,
  getSharedWishlists,
  listActiveShareLinks
} from '../app/lib/db/shared-wishlists';
import { action, loader } from '../app/routes/family';
import { inviteAndProvisionMember } from './family-fixtures';
import type * as PublicSharingAccess from '../app/lib/cloudflare/access-public-sharing';

vi.mock('../app/lib/cloudflare/access-public-sharing', async (importOriginal) => {
  const original = await importOriginal<typeof PublicSharingAccess>();
  return { ...original, ensurePublicSharingAccess: vi.fn() };
});

const organiserEmail = 'organiser@example.com';

function context(email = organiserEmail) {
  const result = new RouterContextProvider();
  result.set(cloudflareContext, {
    env: { ...env, INITIAL_ORGANISER_EMAIL: organiserEmail },
    ctx: createExecutionContext(),
    cspNonce: 'test'
  });
  result.set(identityContext, { email, subject: 'test' });
  return result;
}

function submit(values: [string, string][], email = organiserEmail) {
  const request = new Request('https://wishlist.example/family', {
    method: 'POST',
    body: new URLSearchParams(values)
  });
  return action({
    request,
    params: {},
    context: context(email),
    pattern: '/family',
    url: new URL(request.url)
  });
}

describe('family sharing route', () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM family_share_links'),
      env.DB.prepare('DELETE FROM claims'),
      env.DB.prepare('DELETE FROM items'),
      env.DB.prepare('DELETE FROM wishlists'),
      env.DB.prepare('DELETE FROM family_invitations'),
      env.DB.prepare('DELETE FROM members')
    ]);
    vi.stubEnv('DEV', false);
    vi.mocked(ensurePublicSharingAccess).mockReset();
    vi.mocked(ensurePublicSharingAccess).mockResolvedValue({
      applicationId: crypto.randomUUID(),
      applicationName: 'Public sharing',
      created: false,
      hostname: 'wishlist.example'
    });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates a group link through the server form after the exact host is verified', async () => {
    const admin = await ensureMemberForEmail(env.DB, organiserEmail, organiserEmail);
    const bob = await inviteAndProvisionMember(env.DB, admin, 'bob@example.com');
    const result = await submit([
      ['intent', 'create-family-share-link'],
      ['shareLinkName', 'Grandad'],
      ['wishlistIds', admin.wishlistId],
      ['wishlistIds', bob.wishlistId]
    ]);
    expect(ensurePublicSharingAccess).toHaveBeenCalledWith(expect.anything(), 'wishlist.example');
    expect(result).toMatchObject({ shareLinkName: 'Grandad' });
    if (!('shareUrl' in result) || typeof result.shareUrl !== 'string')
      throw new Error('Expected a created link');
    expect(result.shareUrl).toMatch(/^https:\/\/wishlist.example\/shared\/[A-Za-z0-9_-]{22}$/);
    const token = new URL(result.shareUrl).pathname.split('/')[2];
    await expect(getSharedWishlists(env.DB, token)).resolves.toHaveLength(2);
    const request = new Request('https://wishlist.example/family');
    const loaded = await loader({
      request,
      params: {},
      context: context(),
      pattern: '/family',
      url: new URL(request.url)
    });
    if (loaded instanceof Response) throw new Error('Expected family data');
    expect(loaded.shareableWishlists).toContainEqual({
      id: bob.wishlistId,
      ownerDisplayName: 'bob'
    });
    expect(loaded.shareLinks.map((link) => link.name)).toEqual(['Grandad']);
  });

  it('preserves failed selections and never creates a token when public Access verification fails', async () => {
    const admin = await ensureMemberForEmail(env.DB, organiserEmail, organiserEmail);
    vi.mocked(ensurePublicSharingAccess).mockRejectedValue(
      new PublicSharingAccessError('Sharing setup needs attention.', 'configuration_drift')
    );
    const result = await submit([
      ['intent', 'create-family-share-link'],
      ['shareLinkName', 'Grandad'],
      ['wishlistIds', admin.wishlistId]
    ]);
    expect(result).toMatchObject({
      init: { status: 400 },
      data: {
        familyShareError: 'Sharing setup needs attention.',
        selectedWishlistIds: [admin.wishlistId],
        shareLinkName: 'Grandad'
      }
    });
    await expect(listActiveShareLinks(env.DB, admin.id)).resolves.toEqual([]);
  });

  it('validates an empty selection before making Access calls', async () => {
    const result = await submit([
      ['intent', 'create-family-share-link'],
      ['shareLinkName', 'Grandad']
    ]);
    expect(result).toMatchObject({
      init: { status: 400 },
      data: { familyShareError: 'Choose at least one wishlist to share.' }
    });
    expect(ensurePublicSharingAccess).not.toHaveBeenCalled();
  });

  it.each([false, true])('stops the whole link through a form (enhanced: %s)', async (enhanced) => {
    const admin = await ensureMemberForEmail(env.DB, organiserEmail, organiserEmail);
    const created = await submit([
      ['intent', 'create-family-share-link'],
      ['shareLinkName', 'Grandad'],
      ['wishlistIds', admin.wishlistId]
    ]);
    if (
      !('shareUrl' in created) ||
      typeof created.shareUrl !== 'string' ||
      typeof created.shareLinkId !== 'string'
    )
      throw new Error('Expected a created link');
    const result = await submit([
      ['intent', 'revoke-share-link'],
      ['shareLinkId', created.shareLinkId],
      ['enhancedRemoval', String(enhanced)]
    ]);
    if (enhanced) expect(result).toEqual({ removedShareLinkId: created.shareLinkId });
    else {
      expect(result).toBeInstanceOf(Response);
      if (!(result instanceof Response)) throw new Error('Expected redirect');
      expect(result.headers.get('Location')).toBe('/family#family-sharing');
    }
    await expect(
      getSharedWishlists(env.DB, new URL(created.shareUrl).pathname.split('/')[2])
    ).resolves.toEqual([]);
  });

  it('lets ordinary members share and preselect a list without exposing admission details', async () => {
    const admin = await ensureMemberForEmail(env.DB, organiserEmail, organiserEmail);
    const bob = await inviteAndProvisionMember(env.DB, admin, 'bob@example.com');
    const result = await submit(
      [
        ['intent', 'create-family-share-link'],
        ['shareLinkName', 'Grandad'],
        ['wishlistIds', bob.wishlistId]
      ],
      bob.email
    );
    expect(result).toMatchObject({ shareLinkName: 'Grandad' });
    const request = new Request(`https://wishlist.example/family?list=${bob.wishlistId}&added=1`);
    const loaded = await loader({
      request,
      params: {},
      context: context(bob.email),
      pattern: '/family',
      url: new URL(request.url)
    });
    if (loaded instanceof Response) throw new Error('Expected family data');
    expect(loaded.people).toEqual([]);
    expect(JSON.stringify(loaded)).not.toContain(organiserEmail);
    expect(loaded.added).toBe(false);
    expect(loaded.initialSelectedWishlistIds).toEqual([bob.wishlistId]);
    expect(loaded.shareLinks).toHaveLength(1);
  });

  it.each(['add-member', 'repair-invitation', 'remove-member'])(
    'keeps %s organiser-only',
    async (intent) => {
      const admin = await ensureMemberForEmail(env.DB, organiserEmail, organiserEmail);
      const bob = await inviteAndProvisionMember(env.DB, admin, 'bob@example.com');
      const result = await submit(
        [
          ['intent', intent],
          ['displayName', 'New person'],
          ['email', 'new@example.com'],
          ['memberId', admin.id],
          ['invitationId', crypto.randomUUID()]
        ],
        bob.email
      );
      expect(result).toBeInstanceOf(Response);
      if (!(result instanceof Response)) throw new Error('Expected redirect');
      expect(result.headers.get('Location')).toBe('/');
      expect(ensurePublicSharingAccess).not.toHaveBeenCalled();
      expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM members').first()).toEqual({
        count: 2
      });
      expect(
        await env.DB.prepare('SELECT disabled_at FROM members WHERE id = ?1').bind(admin.id).first()
      ).toEqual({ disabled_at: null });
    }
  );

  it('lists and removes existing single-list links through the same family flow', async () => {
    const admin = await ensureMemberForEmail(env.DB, organiserEmail, organiserEmail);
    const bob = await inviteAndProvisionMember(env.DB, admin, 'bob@example.com');
    const token = await createWishlistShareLink(env.DB, admin.id, bob.wishlistId, 'Old link');
    const request = new Request('https://wishlist.example/family');
    const loaded = await loader({
      request,
      params: {},
      context: context(bob.email),
      pattern: '/family',
      url: new URL(request.url)
    });
    if (loaded instanceof Response) throw new Error('Expected family data');
    const link = loaded.shareLinks[0];
    if (!link) throw new Error('Expected legacy link');
    expect(link.wishlists).toEqual([{ id: bob.wishlistId, ownerDisplayName: 'bob' }]);
    const result = await submit(
      [
        ['intent', 'revoke-share-link'],
        ['shareLinkId', link.id]
      ],
      bob.email
    );
    expect(result).toBeInstanceOf(Response);
    await expect(getSharedWishlists(env.DB, token)).resolves.toEqual([]);
  });
});
