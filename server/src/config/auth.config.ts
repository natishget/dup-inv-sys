import { registerAs } from '@nestjs/config';

export interface AuthConfig {
  jwt: {
    accessSecret: string;
    accessExpiration: string;
    refreshSecret: string;
    refreshExpiration: string;
    refreshCookieName: string;
  };
  throttle: {
    ttl: number;
    limit: number;
    authLimit: number;
  };
  cookieSecret: string;
}

export default registerAs(
  'auth',
  (): AuthConfig => {
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET;

    if (!accessSecret) {
      throw new Error('JWT_ACCESS_SECRET must be defined in the environment variables');
    }
    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET must be defined in the environment variables');
    }

    return {
      jwt: {
        accessSecret,
        accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
        refreshSecret,
        refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
        refreshCookieName: 'refresh_token',
      },
      throttle: {
        ttl: parseInt(process.env.THROTTLE_TTL || '60', 10),
        limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
        authLimit: parseInt(process.env.AUTH_THROTTLE_LIMIT || '5', 10),
      },
      cookieSecret: process.env.COOKIE_SECRET || 'inventory-default-cookie-secret',
    };
  },
);
