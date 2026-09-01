import { productImagePath } from '../lib/product-image';
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
            src={previewUrl ? productImagePath(previewUrl) : undefined}
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

        <div className="product-image-details">
          <div className="product-image-copy">
            <p className="form-label">Picture</p>
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
                  data-product-image=""
                />
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
      </div>
    </div>
  );
}
