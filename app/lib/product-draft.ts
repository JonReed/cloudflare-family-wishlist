export type ProductDraftDetails = {
  productUrl: string;
  title: string;
  price: string;
  imageUrl: string;
  aiAssisted: boolean;
};

/** Fills product-generated fields without replacing details the person has already edited. */
export function fillMissingProductDraft<T extends ProductDraftDetails>(
  existing: T,
  product: ProductDraftDetails
): T {
  return {
    ...existing,
    productUrl: product.productUrl,
    title: existing.title.trim() ? existing.title : product.title,
    price: existing.price.trim() ? existing.price : product.price,
    imageUrl: existing.imageUrl.trim() ? existing.imageUrl : product.imageUrl,
    aiAssisted: product.aiAssisted
  };
}
