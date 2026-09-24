import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode
} from 'react';

const subscribe = () => () => {};
const supportsDialog = () =>
  typeof HTMLDialogElement !== 'undefined' && 'showModal' in HTMLDialogElement.prototype;
const serverSnapshot = () => false;

/** Ignore the progressive-enhancement marker when comparing an editable draft. */
export function dialogDraft(data: FormData): string {
  const values: [string, FormDataEntryValue][] = [];
  data.forEach((value, name) => {
    if (name !== 'enhancedEdit') values.push([name, value]);
  });
  return JSON.stringify(values);
}

type DialogActions = { close: () => void; requestClose: () => void; enhanced: boolean };

/** Choose a wrap target, including pending dialogs with no enabled controls. */
export function dialogTabTarget<T>(
  controls: T[],
  active: T | null,
  backwards: boolean,
  fallback: T
): T | null {
  if (controls.length === 0) return fallback;
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (backwards && (active === first || active === null || !controls.includes(active))) return last;
  if (!backwards && active === last) return first;
  return null;
}

function DialogContent({
  children,
  ...actions
}: DialogActions & {
  children: (actions: DialogActions) => ReactNode;
}) {
  return children(actions);
}

/** Native disclosure without JS; a top-layer dialog after hydration. */
export function ActionDialog({
  trigger,
  title,
  className,
  compact = false,
  protectDraft = false,
  onOpen,
  children
}: {
  trigger: ReactNode;
  title: string;
  className: string;
  compact?: boolean;
  protectDraft?: boolean;
  onOpen?: () => void;
  children: (actions: DialogActions) => ReactNode;
}) {
  const enhanced = useSyncExternalStore(subscribe, supportsDialog, serverSnapshot);
  const [open, setOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const baseline = useRef('');
  const previousFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    document.documentElement.classList.add('has-action-dialog');
    return () => document.documentElement.classList.remove('has-action-dialog');
  }, [open]);

  useEffect(() => {
    if (open || !restoreFocus.current) return;
    restoreFocus.current = false;
    const menu = triggerRef.current?.closest<HTMLDetailsElement>('.wish-more');
    if (menu) {
      menu.open = false;
      menu.querySelector('summary')?.focus({ preventScroll: true });
    } else triggerRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!confirmDiscard && previousFocus.current?.isConnected) {
      previousFocus.current.focus({ preventScroll: true });
      previousFocus.current = null;
    }
  }, [confirmDiscard]);

  const close = useCallback(() => dialogRef.current?.close(), []);
  const requestClose = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.querySelector('form[aria-busy="true"]')) return;
    const form = dialog.querySelector('form');
    if (protectDraft && form && dialogDraft(new FormData(form)) !== baseline.current) {
      previousFocus.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setConfirmDiscard(true);
    } else close();
  }, [close, protectDraft]);
  const mountDialog = useCallback((dialog: HTMLDialogElement | null) => {
    dialogRef.current = dialog;
    if (!dialog) return;
    const form = dialog.querySelector('form');
    baseline.current = form ? dialogDraft(new FormData(form)) : '';
    dialog.showModal();
    dialog
      .querySelector<HTMLElement>('[data-dialog-initial-focus]')
      ?.focus({ preventScroll: true });
  }, []);

  if (!enhanced)
    return (
      <details
        className={className}
        onToggle={(event) => {
          if (event.currentTarget.open) onOpen?.();
        }}
      >
        <summary>{trigger}</summary>
        {children({ close: () => {}, requestClose: () => {}, enhanced: false })}
      </details>
    );

  return (
    <div className={`${className} action-dialog-control`}>
      <button
        ref={triggerRef}
        type="button"
        className="action-dialog-trigger"
        aria-haspopup="dialog"
        onClick={() => {
          setConfirmDiscard(false);
          setOpen(true);
          onOpen?.();
        }}
      >
        {trigger}
      </button>
      {open ? (
        <dialog
          ref={mountDialog}
          className={['action-dialog', compact ? 'action-dialog-compact' : ''].join(' ')}
          aria-labelledby={titleId}
          onKeyDown={(event) => {
            if (event.key !== 'Tab') return;
            const controls = Array.from(
              event.currentTarget.querySelectorAll<HTMLElement>(
                'a[href], button, input, textarea, select, summary, [tabindex]'
              )
            ).filter(
              (element) =>
                element.tabIndex >= 0 &&
                !element.matches(':disabled') &&
                element.getClientRects().length > 0
            );
            const active =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
            const target = dialogTabTarget(
              controls,
              active,
              event.shiftKey,
              event.currentTarget.querySelector<HTMLElement>('h2') ?? event.currentTarget
            );
            if (target) {
              event.preventDefault();
              target.focus();
            }
          }}
          onCancel={(event) => {
            event.preventDefault();
            if (confirmDiscard) setConfirmDiscard(false);
            else requestClose();
          }}
          onClose={() => {
            restoreFocus.current = true;
            setOpen(false);
          }}
        >
          <h2 id={titleId} tabIndex={-1} data-dialog-initial-focus={!compact ? '' : undefined}>
            {title}
          </h2>
          {confirmDiscard ? (
            <div className="dialog-discard" role="alert">
              <p>Discard your unsaved changes?</p>
              <div className="form-actions">
                <button
                  type="button"
                  className="button-primary"
                  ref={(button) => button?.focus({ preventScroll: true })}
                  onClick={() => {
                    setConfirmDiscard(false);
                  }}
                >
                  Keep editing
                </button>
                <button type="button" className="button-danger" onClick={close}>
                  Discard changes
                </button>
              </div>
            </div>
          ) : null}
          <div hidden={confirmDiscard}>
            <DialogContent close={close} requestClose={requestClose} enhanced>
              {children}
            </DialogContent>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}
