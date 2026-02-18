import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey && supabaseServiceKey);

const assertEnv = () => {
  if (!hasSupabaseEnv) {
    throw new Error("Supabase 环境变量未配置完整。");
  }
};

export const getServerSupabase = () => {
  assertEnv();
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
};

