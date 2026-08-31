import { normaliseProductImageUrl } from '../lib/product-url';

export function ProductImageField({
  formId,
  defaultValue = '',
  enhanced = false
}: {
  formId: string;
  defaultValue?: string | null;
  enhanced?: boolean;
}) {
  const previewUrl = normaliseProductImageUrl(defaultValue) ?? '';

  return (
    <div className="product-image-field">
      <div>
        <label htmlFor={`${formId}-image-url`} className="form-label">
          Picture link
        </label>
        <input
          id={`${formId}-image-url`}
          name="imageUrl"
          type="url"
          maxLength={2048}
          defaultValue={defaultValue ?? ''}
          className="form-control"
          placeholder="https://…"
          data-product-image={enhanced ? '' : undefined}
        />
      </div>

      <div
        className="product-image-preview"
        data-product-image-preview={enhanced ? '' : undefined}
        hidden={!previewUrl}
      >
        <img
          src={previewUrl || undefined}
          alt="Product picture preview"
          width="160"
          height="160"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          data-product-image-preview-image={enhanced ? '' : undefined}
        />
      </div>
    </div>
  );
}
