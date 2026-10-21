import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!url || !publishableKey) {
  console.warn("CardVault: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.");
}

export const supabase = createClient(url || "https://placeholder.supabase.co", publishableKey || "placeholder-publishable-key", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/** Establish a persistent anonymous identity. No sign-in form is shown. */
export async function initializeAnonymousSession() {
  const { data: current, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (current.session) return current.session;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error(`${error.message}. Enable Anonymous Sign-Ins in Supabase Authentication settings.`);
  if (!data.session) throw new Error("Supabase did not create an anonymous session.");
  return data.session;
}
