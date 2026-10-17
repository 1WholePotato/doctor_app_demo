import { defineConfig } from 'vitest/config'

export default defineConfig({
  envDir: false,
  test: {
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'test-only-anon-key',
      VITE_STUDENT_ROLE_ID: '',
      VITE_ADMIN_ROLE_ID: '',
    },
  },
})
