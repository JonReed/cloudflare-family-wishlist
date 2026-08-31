import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('profile', 'routes/profile.tsx')
] satisfies RouteConfig;
