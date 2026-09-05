import { EditWishForm } from './edit-wish-form';

export function RemoveWishForm({
  wishlistId,
  itemId,
  title,
  onRemovalStart,
  onRemovalError
}: {
  wishlistId: string;
  itemId: string;
  title: string;
  onRemovalStart: (itemId: string) => void;
  onRemovalError: (form: HTMLFormElement) => void;
}) {
  return (
    <details className="remove-wish-panel removal-confirmation">
      <summary>Remove</summary>
      <EditWishForm
        actionKey={`remove-wish:${itemId}`}
        method="post"
        action={`?index&list=${encodeURIComponent(wishlistId)}`}
        className="removal-confirmation-body"
        onSubmissionError={onRemovalError}
        onSuccess={() => {}}
        onSubmit={() => onRemovalStart(itemId)}
      >
        {({ error, isPending }) => (
          <>
            <p>
              Remove <strong>{title}</strong> from this list? This cannot be undone.
            </p>
            <input type="hidden" name="wishlistId" value={wishlistId} />
            <input type="hidden" name="itemId" value={itemId} />
            <button
              name="intent"
              value="delete-item"
              className="button-danger"
              disabled={isPending}
            >
              {isPending ? 'Removing…' : 'Yes, remove this wish'}
            </button>
            <p className="mutation-submit-status mutation-submit-error" role="alert" tabIndex={-1}>
              {error}
            </p>
          </>
        )}
      </EditWishForm>
    </details>
  );
}
