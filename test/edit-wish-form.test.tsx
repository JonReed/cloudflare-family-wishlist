import { renderToStaticMarkup } from 'react-dom/server';
import { createRoutesStub } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { EditWishForm } from '../app/components/edit-wish-form';

describe('edit wish form', () => {
  it('remains an ordinary server-submittable form before hydration', () => {
    const Routes = createRoutesStub([
      {
        path: '/',
        Component() {
          return (
            <EditWishForm
              actionKey="edit-wish:item-1"
              method="post"
              action="/?index&list=list-1"
              onSubmissionError={vi.fn()}
              onSuccess={vi.fn()}
            >
              {({ isPending }) => (
                <>
                  <input type="hidden" name="wishlistId" value="list-1" />
                  <input type="hidden" name="itemId" value="item-1" />
                  <button name="intent" value="edit-item">
                    {isPending ? 'Saving…' : 'Save changes'}
                  </button>
                </>
              )}
            </EditWishForm>
          );
        }
      }
    ]);

    const html = renderToStaticMarkup(<Routes initialEntries={['/']} />);

    expect(html).toContain('<form');
    expect(html).toContain('action="/?index&amp;list=list-1"');
    expect(html).toContain('method="post"');
    expect(html).toContain('name="enhancedEdit" value="false"');
    expect(html).toContain('name="itemId" value="item-1"');
    expect(html).toContain('value="edit-item"');
    expect(html).toContain('Save changes');
    expect(html).not.toContain('Saving…');
    expect(html).not.toContain('aria-busy="true"');
  });
});
