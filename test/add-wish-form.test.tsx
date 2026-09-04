import { renderToStaticMarkup } from 'react-dom/server';
import { createRoutesStub } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AddWishForm } from '../app/components/add-wish-form';

describe('add wish form', () => {
  it('remains an ordinary server-submittable form before hydration', () => {
    const Routes = createRoutesStub([
      {
        path: '/',
        Component() {
          return (
            <AddWishForm
              actionKey="add-wish:list-1"
              method="post"
              action="/?index&list=list-1"
              onSuccess={vi.fn()}
            >
              {({ isPending }) => (
                <>
                  <input type="hidden" name="wishlistId" value="list-1" />
                  <button name="intent" value="add-item">
                    {isPending ? 'Adding…' : 'Add to the list'}
                  </button>
                </>
              )}
            </AddWishForm>
          );
        }
      }
    ]);

    const html = renderToStaticMarkup(<Routes initialEntries={['/']} />);

    expect(html).toContain('<form');
    expect(html).toContain('action="/?index&amp;list=list-1"');
    expect(html).toContain('method="post"');
    expect(html).toContain('name="enhancedAdd" value="false"');
    expect(html).toContain('name="wishlistId" value="list-1"');
    expect(html).toContain('value="add-item"');
    expect(html).toContain('Add to the list');
    expect(html).not.toContain('Adding…');
    expect(html).not.toContain('aria-busy="true"');
  });
});
