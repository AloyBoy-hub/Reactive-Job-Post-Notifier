const readOptional = (name: string): string | undefined => {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : undefined;
};

export const serverEnv = {
  supabaseUrl: readOptional("SUPABASE_URL"),
  supabaseServiceRoleKey: readOptional("SUPABASE_SERVICE_ROLE_KEY"),
  cronSecret: readOptional("CRON_SECRET"),
  openAiApiKey: readOptional("OPENAI_API_KEY"),
  openAiModel: readOptional("OPENAI_MODEL") ?? "gpt-4.1-mini",
  resendApiKey: readOptional("RESEND_API_KEY"),
  resendFromEmail: readOptional("RESEND_FROM_EMAIL"),
  resendToEmail: readOptional("RESEND_TO_EMAIL"),
  scrapeDelayMs: Number.parseInt(readOptional("SCRAPE_DELAY_MS") ?? "2500", 10)
};
