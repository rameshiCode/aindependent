import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  slug: 'my-app',
  name: 'My App',
  extra: {
    API_URL: process.env.API_URL || 'http://localhost:8000',
  },
});
