import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useFetcher, type FetcherFormProps } from 'react-router';

type AddFamilyMemberResult = {
  added?: boolean;
  error?: string;
};

export type AddFamilyMemberFormState = {
  error: string | null;
  isPending: boolean;
  succeeded: boolean;
};

type AddFamilyMemberFormProps = Omit<FetcherFormProps, 'children'> & {
  children: (state: AddFamilyMemberFormState) => ReactNode;
  serverSucceeded?: boolean;
};

/**
 * Adds a family member in place while retaining the ordinary post-redirect-get
 * flow when browser JavaScript is unavailable.
 */
export function AddFamilyMemberForm({
  children,
  onInput,
  onSubmit,
  serverSucceeded = false,
  ...formProps
}: AddFamilyMemberFormProps) {
  const fetcher = useFetcher<AddFamilyMemberResult>();
  const formRef = useRef<HTMLFormElement>(null);
  const enhancementMarkerRef = useRef<HTMLInputElement>(null);
  const handledResultRef = useRef<AddFamilyMemberResult | null>(null);
  const [serverSuccessDismissed, setServerSuccessDismissed] = useState(false);
  const submittedIntent = fetcher.formData?.get('intent');
  const isPending = fetcher.state !== 'idle' && submittedIntent === 'add-member';
  const error =
    fetcher.state === 'idle' && typeof fetcher.data?.error === 'string' ? fetcher.data.error : null;
  const succeeded =
    (serverSucceeded && !serverSuccessDismissed) ||
    (fetcher.state === 'idle' && fetcher.data?.added === true);

  useEffect(() => {
    if (enhancementMarkerRef.current) enhancementMarkerRef.current.value = 'true';
  });

  useEffect(() => {
    const result = fetcher.data;
    if (
      fetcher.state !== 'idle' ||
      result?.added !== true ||
      result === handledResultRef.current ||
      !formRef.current
    ) {
      return;
    }

    handledResultRef.current = result;
    let nameField: HTMLInputElement | null = null;
    for (const fieldName of ['displayName', 'email']) {
      const field = formRef.current.elements.namedItem(fieldName);
      if (field instanceof HTMLInputElement) {
        field.value = '';
        field.defaultValue = '';
        if (fieldName === 'displayName') nameField = field;
      }
    }

    nameField?.focus({ preventScroll: true });
  }, [fetcher.data, fetcher.state]);

  return (
    <fetcher.Form
      {...formProps}
      ref={formRef}
      aria-busy={isPending || undefined}
      onInput={(event) => {
        setServerSuccessDismissed(true);
        if (fetcher.state === 'idle' && fetcher.data) fetcher.reset();
        onInput?.(event);
      }}
      onSubmit={(event) => {
        setServerSuccessDismissed(true);
        if (enhancementMarkerRef.current) enhancementMarkerRef.current.value = 'true';
        onSubmit?.(event);
      }}
    >
      <input
        ref={enhancementMarkerRef}
        type="hidden"
        name="enhancedAddMember"
        defaultValue="false"
      />
      {children({ error, isPending, succeeded })}
    </fetcher.Form>
  );
}
