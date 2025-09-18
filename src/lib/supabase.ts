import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// These are the types of requests customers can make
export type RequestType = 'table_clean' | 'toilet_clean' | 'ready_to_order' | 'additional_order' | 'replace_cutlery' | 'request_sauces'