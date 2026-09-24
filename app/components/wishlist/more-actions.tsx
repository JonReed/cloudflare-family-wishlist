import { useEffect, useRef, type ReactNode } from 'react';

/** A native disclosure, enhanced with outside-click and Escape dismissal. */
export function WishMoreActions({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      const menu = ref.current;
      if (
        menu?.open &&
        !menu.querySelector('dialog[open]') &&
        event.target instanceof Node &&
        !menu.contains(event.target)
      )
        menu.open = false;
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);
  return (
    <details
      ref={ref}
      className="wish-more"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || ref.current?.querySelector('dialog[open]')) return;
        event.preventDefault();
        if (ref.current) {
          ref.current.open = false;
          ref.current.querySelector('summary')?.focus({ preventScroll: true });
        }
      }}
      onBlur={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget) &&
          !event.currentTarget.querySelector('dialog[open]')
        )
          event.currentTarget.open = false;
      }}
    >
      <summary>
        <span>
          Edit this wish <span aria-hidden="true">▾</span>
        </span>
      </summary>
      <div className="wish-item-actions">{children}</div>
    </details>
  );
}
