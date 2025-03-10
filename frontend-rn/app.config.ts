import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  slug: 'AIndependent',
  name: 'AIndependent',
  extra: {
    API_URL: process.env.API_URL || 'http://localhost:8000',
  },
});
