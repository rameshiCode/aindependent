// Update to app.config.ts
import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  slug: 'AIndependent',
  name: 'AIndependent',
  extra: {
    API_URL: process.env.API_URL || 'http://localhost:8000',
    STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_51R04QIF7P8kDElAhIvVr0fDR3qSwPClQOSeTGaQhGAculMikrRATQaPFdF8G5chyz7ntVNOLAoC3A1weNRMDk4Qk00k20RqJ79',
  },
});