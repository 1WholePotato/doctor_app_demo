import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
