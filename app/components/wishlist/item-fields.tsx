import type { WishlistItem } from '../../lib/db/wishlists';
import type { ProductFormDraft } from '../../lib/wishlist-form-draft';
import { ProductImageField } from '../product-image-field';

function priceInputValue(item: WishlistItem): string {
  if (item.priceAmountMinor === null) return '';
  return (item.priceAmountMinor / 100).toFixed(2);
}

export function ItemFields({
  item,
  formId,
  recipientName,
  urlFirst = false,
  draft,
  urlAction,
  urlStatus
}: {
  item?: WishlistItem;
  formId: string;
  recipientName: string;
  urlFirst?: boolean;
  draft?: ProductFormDraft;
  urlAction?: React.ReactNode;
  urlStatus?: React.ReactNode;
}) {
  const priorityField = (
    <div>
      <label htmlFor={`${formId}-priority`} className="form-label">
        How much would {recipientName} like it?
      </label>
      <select
        id={`${formId}-priority`}
        name="priority"
        defaultValue={item?.priority ?? draft?.priority ?? 'normal'}
        className="form-control"
      >
        <option value="high">Top wish</option>
        <option value="normal">Would love</option>
        <option value="low">Nice to have</option>
      </select>
    </div>
  );
  const urlField = (
    <div>
      <label htmlFor={`${formId}-url`} className="form-label">
        {urlFirst ? 'Start with a link' : 'Where can we find it?'}
      </label>
      <div className={urlFirst ? 'product-link-field' : undefined}>
        <input
          id={`${formId}-url`}
          name="productUrl"
          type="url"
          maxLength={2048}
          defaultValue={item?.productUrl ?? draft?.productUrl ?? ''}
          className="form-control"
          placeholder={urlFirst ? 'Paste the shop or product link' : 'https://…'}
          data-product-url={urlFirst ? '' : undefined}
        />
        {urlFirst ? urlAction : null}
      </div>
      {urlFirst ? urlStatus : null}
    </div>
  );

  return (
    <div className="form-fields">
      {urlFirst ? urlField : null}

      <div>
        <label htmlFor={`${formId}-title`} className="form-label">
          What would {recipientName} love? <span aria-hidden="true">*</span>
        </label>
        <input
          id={`${formId}-title`}
          name="title"
          required
          maxLength={160}
          defaultValue={item?.title ?? draft?.title}
          className="form-control"
          placeholder="A book, cosy socks, the good chocolate…"
          data-product-title={urlFirst ? '' : undefined}
        />
      </div>

      <ProductImageField formId={formId} defaultValue={item?.imageUrl ?? draft?.imageUrl} />

      <div>
        <label htmlFor={`${formId}-notes`} className="form-label">
          Anything else to know?
        </label>
        <textarea
          id={`${formId}-notes`}
          name="notes"
          rows={urlFirst ? 2 : 3}
          maxLength={2000}
          defaultValue={item?.notes ?? draft?.notes ?? ''}
          className="form-control resize-y"
          placeholder="Colour, size, edition, or anything else worth knowing"
        />
      </div>

      <div className="form-split">
        {urlFirst ? null : urlField}
        <div>
          <label htmlFor={`${formId}-price`} className="form-label">
            Rough price
          </label>
          <div className="price-field">
            <span aria-hidden="true">£</span>
            <input
              id={`${formId}-price`}
              name="price"
              inputMode="decimal"
              pattern="(?:0|[1-9][0-9]{0,6})(?:\.[0-9]{1,2})?"
              defaultValue={item ? priceInputValue(item) : (draft?.price ?? '')}
              className="form-control"
              placeholder="0.99"
              data-product-price={urlFirst ? '' : undefined}
            />
          </div>
        </div>
        {urlFirst ? priorityField : null}
      </div>

      {urlFirst ? null : priorityField}
    </div>
  );
}
