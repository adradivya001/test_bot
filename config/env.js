const dotenv = require('dotenv');
const { z } = require('zod');

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  META_PHONE_NUMBER_ID: z.string().default('mock_phone_number_id'),
  META_ACCESS_TOKEN: z.string().default('mock_access_token'),
  META_VERIFY_TOKEN: z.string().default('mock_verify_token'),
  REDIS_URL: z.string().url('Invalid REDIS_URL').default('redis://localhost:6379'),
  BACKEND_API_URL: z.string().url('Invalid BACKEND_API_URL').default('http://localhost:8080'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Environment validation failed:', parsedEnv.error.format());
  process.exit(1);
}

module.exports = {
  env: parsedEnv.data
};
