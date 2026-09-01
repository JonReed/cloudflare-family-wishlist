import { Form } from 'react-router';

export function FamilyMemberRemoval({
  displayName,
  memberId
}: {
  displayName: string;
  memberId: string;
}) {
  return (
    <details className="family-remove-access">
      <summary>Remove access</summary>
      <div className="family-remove-access-body">
        <p>
          <strong>{displayName}</strong> will no longer be able to sign in. Their wishlist and
          wishes will stay here. Everyone will be signed out so the change takes effect.
        </p>
        <Form method="post">
          <input type="hidden" name="intent" value="remove-member" />
          <input type="hidden" name="memberId" value={memberId} />
          <button type="submit" className="button-danger">
            Yes, remove their access
          </button>
        </Form>
      </div>
    </details>
  );
}
