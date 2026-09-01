import type { ReactNode } from 'react';
import { useFetcher, type FetcherFormProps } from 'react-router';

type InPlaceActionResult = {
  error?: string;
};

export type InPlaceActionState = {
  isPending: boolean;
  submittedIntent: string | null;
};

type InPlaceActionFormProps = Omit<FetcherFormProps, 'children'> & {
  actionKey: string;
  children: ReactNode | ((state: InPlaceActionState) => ReactNode);
};

/**
 * A progressively enhanced mutation form for small updates that should not
 * change the current page. Without JavaScript, it remains an ordinary form.
 */
export function InPlaceActionForm({ actionKey, children, ...formProps }: InPlaceActionFormProps) {
  const fetcher = useFetcher<InPlaceActionResult>({ key: actionKey });
  const submittedIntent = fetcher.formData?.get('intent');
  const state: InPlaceActionState = {
    isPending: fetcher.state !== 'idle',
    submittedIntent: typeof submittedIntent === 'string' ? submittedIntent : null
  };

  return (
    <fetcher.Form {...formProps} aria-busy={state.isPending || undefined}>
      {typeof children === 'function' ? children(state) : children}
      {fetcher.data?.error ? (
        <p className="in-place-action-error" role="alert">
          {fetcher.data.error}
        </p>
      ) : null}
    </fetcher.Form>
  );
}
