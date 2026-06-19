import request from 'supertest';
import { app } from '../src/app/server';
import { env } from '../src/config/env';
import { sessionRepository } from '../src/sessions/session.repository';

describe('Webhook Controller Endpoints', () => {
  describe('GET /health', () => {
    it('should return 200 OK with status: ok', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });
  });

  describe('GET /webhook', () => {
    it('should return challenge with 200 OK when tokens match', async () => {
      const response = await request(app)
        .get('/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': env.META_VERIFY_TOKEN,
          'hub.challenge': 'challenge_token_xyz'
        });

      expect(response.status).toBe(200);
      expect(response.text).toBe('challenge_token_xyz');
    });

    it('should return 403 Forbidden when tokens mismatch', async () => {
      const response = await request(app)
        .get('/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong_token',
          'hub.challenge': '123'
        });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /webhook', () => {
    it('should accept message webhook requests and return 200 EVENT_RECEIVED instantly', async () => {
      const response = await request(app)
        .post('/webhook')
        .send({
          object: 'whatsapp_business_account',
          entry: []
        });

      expect(response.status).toBe(200);
      expect(response.text).toBe('EVENT_RECEIVED');
    });
  });

  afterAll(async () => {
    await sessionRepository.close();
  });
});
