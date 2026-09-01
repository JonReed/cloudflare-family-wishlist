import { renderToStaticMarkup } from 'react-dom/server';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';

import { FamilyMemberRemoval } from '../app/components/family-member-removal';

describe('FamilyMemberRemoval', () => {
  it('puts access removal behind an accurate explicit confirmation', () => {
    const Routes = createRoutesStub([
      {
        path: '/',
        Component() {
          return <FamilyMemberRemoval displayName="Granny Smith" memberId="member-2" />;
        }
      }
    ]);

    const html = renderToStaticMarkup(<Routes initialEntries={['/']} />);

    expect(html).toContain('<summary>Remove access</summary>');
    expect(html).toContain('<strong>Granny Smith</strong>');
    expect(html).toContain('will no longer be able to sign in');
    expect(html).toContain('Their wishlist and wishes will stay here.');
    expect(html).toContain('Everyone will be signed out');
    expect(html).toContain('name="intent" value="remove-member"');
    expect(html).toContain('name="memberId" value="member-2"');
    expect(html).toContain('Yes, remove their access');
  });
});
