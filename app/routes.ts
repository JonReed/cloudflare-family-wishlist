import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('add', 'routes/add.tsx'),
  route('profile', 'routes/profile.tsx'),
  route('product-details', 'routes/product-details.ts')
] satisfies RouteConfig;
