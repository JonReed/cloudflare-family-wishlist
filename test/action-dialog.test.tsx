import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ActionDialog, dialogDraft, dialogTabTarget } from '../app/components/action-dialog';

describe('progressively enhanced action dialog', () => {
  it('keeps Tab and Shift+Tab inside a pending dialog with no enabled controls', () => {
    expect(dialogTabTarget([], 'disabled-button', false, 'heading')).toBe('heading');
    expect(dialogTabTarget([], 'heading', true, 'heading')).toBe('heading');
  });

  it('wraps both ends without interfering with normal tab order', () => {
    const controls = ['first', 'middle', 'last'];
    expect(dialogTabTarget(controls, 'last', false, 'heading')).toBe('first');
    expect(dialogTabTarget(controls, 'first', true, 'heading')).toBe('last');
    expect(dialogTabTarget(controls, 'heading', true, 'heading')).toBe('last');
    expect(dialogTabTarget(controls, 'middle', false, 'heading')).toBeNull();
  });
  it('renders a closed native disclosure and usable form without JavaScript', () => {
    const html = renderToStaticMarkup(
      <ActionDialog className="edit-panel" title="Edit this wish" trigger="Edit" protectDraft>
        {({ enhanced }) => (
          <form method="post">
            <input name="title" defaultValue="A book" />
            <button>Save</button>
            {enhanced ? <button type="button">Cancel</button> : null}
          </form>
        )}
      </ActionDialog>
    );
    expect(html).toContain('<details class="edit-panel"><summary>Edit</summary>');
    expect(html).toContain('<form method="post">');
    expect(html).not.toContain('<dialog');
    expect(html).not.toContain(' open');
    expect(html).not.toContain('Cancel');
  });

  it('ignores enhancement markers but detects changes to all editable values', () => {
    const data = new FormData();
    for (const name of ['title', 'notes', 'productUrl', 'imageUrl', 'price', 'priority'])
      data.set(name, 'original');
    data.set('enhancedEdit', 'false');
    const baseline = dialogDraft(data);
    data.set('enhancedEdit', 'true');
    expect(dialogDraft(data)).toBe(baseline);
    for (const name of ['title', 'notes', 'productUrl', 'imageUrl', 'price', 'priority']) {
      data.set(name, 'changed');
      expect(dialogDraft(data)).not.toBe(baseline);
      data.set(name, 'original');
    }
    expect(dialogDraft(data)).toBe(baseline);
  });
});
