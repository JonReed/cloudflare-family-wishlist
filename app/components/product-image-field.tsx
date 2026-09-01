import { normaliseProductImageUrl } from '../lib/product-url';

export function ProductImageField({
  formId,
  defaultValue = ''
}: {
  formId: string;
  defaultValue?: string | null;
}) {
  const previewUrl = normaliseProductImageUrl(defaultValue) ?? '';
  const hasPreview = Boolean(previewUrl);

  return (
    <div className="product-image-field" data-product-image-field="">
      <div className="product-image-overview">
        <div className="product-image-preview" data-product-image-preview="" hidden={!hasPreview}>
          <img
            src={previewUrl || undefined}
            alt="Product picture preview"
            width="160"
            height="160"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            data-product-image-preview-image=""
          />
        </div>

        <div className="product-image-empty" data-product-image-empty="" hidden={hasPreview}>
          <span aria-hidden="true">+</span>
        </div>

        <div className="product-image-copy">
          <p className="form-label">Picture</p>
          <strong data-product-image-present="" hidden={!hasPreview}>
            Here’s the picture we’ll use
          </strong>
          <strong data-product-image-missing="" hidden={hasPreview}>
            No picture yet
          </strong>
          <p data-product-image-present="" hidden={!hasPreview}>
            Check that it shows the right product. You can change or remove it before saving.
          </p>
          <p data-product-image-missing="" hidden={hasPreview}>
            It’s optional, but a picture can make the wish easier to recognise.
          </p>
        </div>
      </div>

      <div className="product-image-actions">
        <details className="product-image-editor">
          <summary className="button-quiet">
            <span data-product-image-present="" hidden={!hasPreview}>
              Change picture
            </span>
            <span data-product-image-missing="" hidden={hasPreview}>
              Add a picture
            </span>
          </summary>
          <div className="product-image-editor-fields">
            <label htmlFor={`${formId}-image-url`} className="form-label">
              Picture address
            </label>
            <input
              id={`${formId}-image-url`}
              name="imageUrl"
              type="url"
              maxLength={2048}
              defaultValue={defaultValue ?? ''}
              className="form-control"
              placeholder="https://…"
              aria-describedby={`${formId}-image-url-hint`}
              data-product-image=""
            />
            <p id={`${formId}-image-url-hint`} className="product-image-hint">
              If you have another picture online, paste its direct web address here.
            </p>
          </div>
        </details>

        <button
          type="button"
          className="button-quiet product-image-remove"
          data-product-image-remove=""
          hidden
        >
          Remove picture
        </button>
      </div>
    </div>
  );
}
