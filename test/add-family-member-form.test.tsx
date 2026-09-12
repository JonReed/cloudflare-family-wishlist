import { renderToStaticMarkup } from 'react-dom/server';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AddFamilyMemberForm } from '../app/components/add-family-member-form';

describe('add family member form', () => {
  it('remains an ordinary server-submittable form before hydration', () => {
    const Routes = createRoutesStub([
      {
        path: '/',
        Component() {
          return (
            <AddFamilyMemberForm method="post">
              {({ isPending, succeeded }) => (
                <>
                  <input type="hidden" name="intent" value="add-member" />
                  <input name="displayName" />
                  <input name="email" type="email" />
                  <button type="submit">{isPending ? 'Adding…' : 'Add to the family'}</button>
                  <p role="status">{succeeded ? 'Added to your family.' : ''}</p>
                </>
              )}
            </AddFamilyMemberForm>
          );
        }
      }
    ]);

    const html = renderToStaticMarkup(<Routes initialEntries={['/']} />);

    expect(html).toContain('<form');
    expect(html).toContain('method="post"');
    expect(html).toContain('name="enhancedAddMember" value="false"');
    expect(html).toContain('name="intent" value="add-member"');
    expect(html).toContain('name="displayName"');
    expect(html).toContain('type="email" name="email"');
    expect(html).toContain('Add to the family');
    expect(html).not.toContain('Adding…');
    expect(html).not.toContain('aria-busy="true"');
  });

  it('renders a server-confirmed success for the no-JavaScript redirect flow', () => {
    const Routes = createRoutesStub([
      {
        path: '/',
        Component() {
          return (
            <AddFamilyMemberForm method="post" serverSucceeded>
              {({ succeeded }) => <p role="status">{succeeded ? 'Added to your family.' : ''}</p>}
            </AddFamilyMemberForm>
          );
        }
      }
    ]);

    const html = renderToStaticMarkup(<Routes initialEntries={['/']} />);

    expect(html).toContain('<p role="status">Added to your family.</p>');
    expect(html).toContain('name="enhancedAddMember" value="false"');
  });
});
