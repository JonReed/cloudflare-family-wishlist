import { renderToStaticMarkup } from 'react-dom/server';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';

import { InPlaceActionForm } from '../app/components/in-place-action-form';

describe('in-place action form', () => {
  it('renders as an ordinary server-submittable form before hydration', () => {
    const Routes = createRoutesStub([
      {
        path: '/',
        Component() {
          return (
            <InPlaceActionForm actionKey="claim:item-1" method="post" action="/?index">
              <input type="hidden" name="itemId" value="item-1" />
              <button name="intent" value="claim-item">
                I’ll get this
              </button>
            </InPlaceActionForm>
          );
        }
      }
    ]);

    const html = renderToStaticMarkup(<Routes initialEntries={['/']} />);

    expect(html).toContain('<form');
    expect(html).toContain('action="/?index"');
    expect(html).toContain('method="post"');
    expect(html).toContain('name="itemId" value="item-1"');
    expect(html).toContain('name="intent"');
    expect(html).toContain('value="claim-item"');
    expect(html).toContain('I’ll get this');
  });
});
