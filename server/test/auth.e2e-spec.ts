import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let refreshCookie: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.use(cookieParser('inventory-default-cookie-secret'));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/login', () => {
    it('should fail with 401 on invalid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'admin@inventory.local',
          password: 'IncorrectPassword!',
        })
        .expect(401);

      expect(response.body.message).toBe('Invalid email or password');
    });

    it('should fail with 400 when body fails DTO validation (invalid email)', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'not-an-email',
          password: 'AdminPassword123!',
        })
        .expect(400);
    });

    it('should successfully log in seeded admin, return access token and set HttpOnly refresh cookie', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'admin@inventory.local',
          password: 'AdminPassword123!',
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user).toMatchObject({
        email: 'admin@inventory.local',
        role: 'ADMIN',
        isActive: true,
      });
      expect(response.body.user).not.toHaveProperty('password');
      expect(response.body.user).not.toHaveProperty('rememberToken');

      accessToken = response.body.accessToken;

      // Verify Set-Cookie header contains refresh_token with HttpOnly
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const rawCookie = Array.isArray(cookies) ? cookies[0] : cookies;
      expect(rawCookie).toContain('refresh_token=');
      expect(rawCookie).toContain('HttpOnly');

      refreshCookie = rawCookie.split(';')[0];
    });
  });

  describe('GET /auth/me', () => {
    it('should reject unauthenticated requests with 401 Unauthorized', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);
    });

    it('should reject invalid Bearer tokens with 401 Unauthorized', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid.token.value')
        .expect(401);
    });

    it('should return authenticated user profile when valid access token is provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.email).toBe('admin@inventory.local');
      expect(response.body.role).toBe('ADMIN');
      expect(response.body).not.toHaveProperty('password');
    });
  });

  describe('POST /auth/refresh', () => {
    it('should reject refresh without cookie with 401 Unauthorized', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .expect(401);
    });

    it('should rotate access and refresh tokens when sending valid refresh cookie', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', [refreshCookie])
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(typeof response.body.accessToken).toBe('string');

      // Update access token & cookie for subsequent tests
      accessToken = response.body.accessToken;
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const rawCookie = Array.isArray(cookies) ? cookies[0] : cookies;
      refreshCookie = rawCookie.split(';')[0];
    });
  });

  describe('POST /auth/logout', () => {
    it('should clear refresh cookie and invalidate refresh session', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.message).toBe('Successfully logged out');

      // Subsequent refresh with old cookie must fail because DB record was cleared
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', [refreshCookie])
        .expect(401);
    });
  });
});
