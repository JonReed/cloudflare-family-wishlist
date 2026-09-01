import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AccessSignOut } from '../app/components/access-sign-out';

describe('AccessSignOut', () => {
  it('puts the account-wide Access logout behind an explicit confirmation', () => {
    const html = renderToStaticMarkup(<AccessSignOut email="jon@example.com" />);

    expect(html).toContain('<summary>Sign out on all devices</summary>');
    expect(html).toContain('jon@example.com');
    expect(html).toContain('Other family members stay signed in.');
    expect(html).toContain('href="/cdn-cgi/access/logout"');
    expect(html).toContain('Yes, sign out everywhere');
  });
});
