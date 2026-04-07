import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://fwgwgeehrronfqilkdha.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3Z3dnZWVocnJvbmZxaWxrZGhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDkwMTksImV4cCI6MjA4ODEyNTAxOX0.shje9cXB9MqXUvHvv8elCTI3AxL24z9b3hRfzH35i_U"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)