import { useEffect, useRef, type ReactNode } from 'react';
import { useFetcher, type FetcherFormProps } from 'react-router';

type EditWishResult = {
  error?: string;
  updated?: string;
};

export type EditWishFormState = {
  error: string | null;
  isPending: boolean;
  submittedIntent: string | null;
  succeeded: boolean;
};

type EditWishFormProps = Omit<FetcherFormProps, 'children'> & {
  actionKey: string;
  children: (state: EditWishFormState) => ReactNode;
  onSubmissionError: (form: HTMLFormElement) => void;
  onSuccess: (form: HTMLFormElement) => void;
};

/**
 * Saves an expanded wish editor in place while retaining its native form fallback.
 * The browser-only marker lets document submissions keep post-redirect-get.
 */
export function EditWishForm({
  actionKey,
  children,
  onSubmissionError,
  onSuccess,
  ...formProps
}: EditWishFormProps) {
  const fetcher = useFetcher<EditWishResult>({ key: actionKey });
  const formRef = useRef<HTMLFormElement>(null);
  const enhancementMarkerRef = useRef<HTMLInputElement>(null);
  const handledResultRef = useRef<EditWishResult | null>(null);
  const submittedIntent = fetcher.formData?.get('intent');
  const state: EditWishFormState = {
    error:
      fetcher.state === 'idle' && typeof fetcher.data?.error === 'string'
        ? fetcher.data.error
        : null,
    isPending: fetcher.state !== 'idle',
    submittedIntent: typeof submittedIntent === 'string' ? submittedIntent : null,
    succeeded: fetcher.state === 'idle' && fetcher.data?.updated === 'edit'
  };

  useEffect(() => {
    // A completed fetcher submission resets its form, so reapply this after every render.
    if (enhancementMarkerRef.current) enhancementMarkerRef.current.value = 'true';
  });

  useEffect(() => {
    const result = fetcher.data;
    if (fetcher.state !== 'idle' || result === handledResultRef.current || !formRef.current) {
      return;
    }

    if (result?.updated === 'edit') {
      handledResultRef.current = result;
      onSuccess(formRef.current);
    } else if (typeof result?.error === 'string') {
      handledResultRef.current = result;
      onSubmissionError(formRef.current);
    }
  }, [fetcher.data, fetcher.state, onSubmissionError, onSuccess]);

  return (
    <fetcher.Form {...formProps} ref={formRef} aria-busy={state.isPending || undefined}>
      <input ref={enhancementMarkerRef} type="hidden" name="enhancedEdit" defaultValue="false" />
      {children(state)}
    </fetcher.Form>
  );
}
