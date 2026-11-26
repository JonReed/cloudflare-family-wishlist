import { fillMissingProductDraft } from './product-draft';
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

export function submittedWishDraft(formData: FormData): ProductFormDraft {
  const priority = boundedDraftValue(formData, 'priority', 16);
  return {
    productUrl: boundedDraftValue(formData, 'productUrl', 2048),
    title: boundedDraftValue(formData, 'title', 160),
    price: boundedDraftValue(formData, 'price', 32),
    imageUrl: boundedDraftValue(formData, 'imageUrl', 2048),
    notes: boundedDraftValue(formData, 'notes', 2000),
    priority: isDraftPriority(priority) ? priority : 'normal',
    aiAssisted: false
  };
}

export function productFormDraft(formData: FormData, product: ProductMetadata): ProductFormDraft {
  return fillMissingProductDraft(submittedWishDraft(formData), product);
}
