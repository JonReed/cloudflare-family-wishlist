import type { ProductMetadata } from './product-metadata';

export type ProductFormDraft = ProductMetadata & {
  notes: string;
  priority: 'low' | 'normal' | 'high';
};

function boundedDraftValue(formData: FormData, name: string, maxLength: number): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

function isDraftPriority(value: string): value is ProductFormDraft['priority'] {
  return value === 'low' || value === 'normal' || value === 'high';
}

export function productFormDraft(
  formData: FormData,
  product: ProductMetadata,
  productUrl = product.productUrl
): ProductFormDraft {
  const existingTitle = boundedDraftValue(formData, 'title', 160);
  const existingPrice = boundedDraftValue(formData, 'price', 32);
  const existingImageUrl = boundedDraftValue(formData, 'imageUrl', 2048);
  const rawPriority = boundedDraftValue(formData, 'priority', 16);

  return {
    ...product,
    productUrl,
    title: existingTitle.trim() ? existingTitle : product.title,
    price: existingPrice.trim() ? existingPrice : product.price,
    imageUrl: existingImageUrl.trim() ? existingImageUrl : product.imageUrl,
    notes: boundedDraftValue(formData, 'notes', 2000),
    priority: isDraftPriority(rawPriority) ? rawPriority : 'normal'
  };
}
