type FetchPage = (url: string, init: RequestInit) => Promise<Response>;

type RenderedProductPage = {
  html: string;
  finalUrl: string;
  navigationUrls: string[];
};

export type ProductPageRenderer = (url: string) => Promise<RenderedProductPage | null>;

export type ProductMetadata = {
  productUrl: string;
  title: string;
  price: string;
  imageUrl: string;
  aiAssisted: boolean;
};

type ProductAiRequest = {
  pageText: string;
  needsTitle: boolean;
  needsPrice: boolean;
  imageCandidates: ProductAiImageCandidate[];
};

export type ProductAiResult = {
  title: string;
  price: string;
  currency: string;
  imageIndex: number | null;
};

export type ProductAiImageCandidate = {
  index: number;
  url: string;
  alt: string;
  title: string;
  width: number | null;
  height: number | null;
};

export type ProductAiExtractor = (request: ProductAiRequest) => Promise<ProductAiResult>;

export type ProductMetadataOptions = {
  fetchPage?: FetchPage;
  renderPage?: ProductPageRenderer;
  extractWithAi?: ProductAiExtractor;
};

export type ProductDiagnostics = { hostname: string; steps: string[] };

export class ProductMetadataError extends Error {
  diagnostics?: ProductDiagnostics;
}

// Only fixed descriptions and numeric HTTP statuses may cross the diagnostics boundary.
export class ProductRenderError extends Error {}

export type PageEvidence = {
  meta: Map<string, string>;
  values: Map<string, string[]>;
  challengeDetected: boolean;
};

export type PriceCandidate = {
  price: string;
  currency: string;
};

export type JsonLdProduct = {
  titles: string[];
  breadcrumbTitles: string[];
  prices: PriceCandidate[];
  images: string[];
};

export type ExtractedMetadata = ProductMetadata & {
  titleIsReliable: boolean;
  challengeDetected: boolean;
};

export type RetailerAdapter = {
  matches: (url: URL) => boolean;
  htmlByteLimit?: number;
  cleanTitle: (title: string) => string;
  titleCandidates: (evidence: PageEvidence) => string[];
  priceCandidates: (evidence: PageEvidence) => PriceCandidate[];
  imageCandidates: (evidence: PageEvidence) => string[];
  retryUrl: (url: URL) => URL;
  canonicalUrl: (url: URL) => URL;
};

export type PreparedAiEvidence = {
  pageText: string;
  imageCandidates: ProductAiImageCandidate[];
};
