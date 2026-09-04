import { useEffect, useRef, type ReactNode } from 'react';
import { useFetcher, type FetcherFormProps } from 'react-router';

type AddWishResult = {
  error?: string;
  updated?: string;
};

export type AddWishFormState = {
  error: string | null;
  isPending: boolean;
  succeeded: boolean;
};

type AddWishFormProps = Omit<FetcherFormProps, 'children'> & {
  actionKey: string;
  children: (state: AddWishFormState) => ReactNode;
  onSuccess: (form: HTMLFormElement) => void;
};

/**
 * Enhances the frequent add mutation without changing its native form fallback.
 * The browser-only marker lets the route retain post-redirect-get for document posts.
 */
export function AddWishForm({ actionKey, children, onSuccess, ...formProps }: AddWishFormProps) {
  const fetcher = useFetcher<AddWishResult>({ key: actionKey });
  const formRef = useRef<HTMLFormElement>(null);
  const enhancementMarkerRef = useRef<HTMLInputElement>(null);
  const handledResultRef = useRef<AddWishResult | null>(null);

  const isPending = fetcher.state !== 'idle' && fetcher.formData?.get('intent') === 'add-item';
  const error =
    fetcher.state === 'idle' && typeof fetcher.data?.error === 'string' ? fetcher.data.error : null;
  const succeeded = fetcher.state === 'idle' && fetcher.data?.updated === 'add';

  useEffect(() => {
    // A completed fetcher submission resets its form, so reapply this after every render.
    if (enhancementMarkerRef.current) enhancementMarkerRef.current.value = 'true';
  });

  useEffect(() => {
    const result = fetcher.data;
    if (
      fetcher.state !== 'idle' ||
      result?.updated !== 'add' ||
      result === handledResultRef.current ||
      !formRef.current
    ) {
      return;
    }

    handledResultRef.current = result;
    onSuccess(formRef.current);
  }, [fetcher.data, fetcher.state, onSuccess]);

  return (
    <fetcher.Form {...formProps} ref={formRef} aria-busy={isPending || undefined}>
      <input ref={enhancementMarkerRef} type="hidden" name="enhancedAdd" defaultValue="false" />
      {children({ error, isPending, succeeded })}
    </fetcher.Form>
  );
}
