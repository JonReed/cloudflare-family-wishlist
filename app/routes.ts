import { type RouteConfig, index, layout, route } from '@react-router/dev/routes';

export default [
  layout('routes/app-layout.tsx', [
    index('routes/home.tsx'),
    route('add', 'routes/add.tsx'),
    route('bookmarklet', 'routes/bookmarklet.tsx'),
    route('family', 'routes/family.tsx'),
    route('profile', 'routes/profile.tsx'),
    route('avatar/:memberId', 'routes/avatar.ts'),
    route('product-details', 'routes/product-details.ts'),
    route('share-target', 'routes/share-target.ts')
  ]),
  route('shared/:token', 'routes/shared-wishlist.tsx')
] satisfies RouteConfig;
