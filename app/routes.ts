import { type RouteConfig, index, layout, route } from '@react-router/dev/routes';

export default [
  layout('routes/app-layout.tsx', [
    index('routes/home.tsx'),
    route('add', 'routes/add.tsx'),
    route('bookmarklet', 'routes/bookmarklet.tsx'),
    route('family', 'routes/family.tsx'),
    route('profile', 'routes/profile.tsx'),
    route('product-image', 'routes/product-image.ts'),
    route('product-details', 'routes/product-details.ts'),
    route('share-target', 'routes/share-target.ts')
  ]),
  route('shared/:token', 'routes/shared-wishlist.tsx'),
  route('shared/:token/image/:itemId', 'routes/shared-wishlist-image.ts')
] satisfies RouteConfig;
