(process.env as Record<string, string>).NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/dealeros_test';
process.env.DIRECT_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test-project.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-anon-key';
process.env.AUTH_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || 'test-only-auth-token-secret-do-not-use-in-production';
