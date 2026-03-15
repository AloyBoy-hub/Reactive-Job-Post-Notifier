const readRequired = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const readOptional = (name: string): string | undefined => {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : undefined;
};

export const serverEnv = {
  supabaseUrl: readRequired("SUPABASE_URL"),
  supabaseServiceRoleKey: readRequired("SUPABASE_SERVICE_ROLE_KEY"),
  cronSecret: readRequired("CRON_SECRET"),
  openAiApiKey: readOptional("OPENAI_API_KEY"),
  openAiModel: readOptional("OPENAI_MODEL") ?? "gpt-4.1-mini",
  resendApiKey: readOptional("RESEND_API_KEY"),
  resendFromEmail: readOptional("RESEND_FROM_EMAIL"),
  resendToEmail: readOptional("RESEND_TO_EMAIL"),
  scrapeDelayMs: Number.parseInt(readOptional("SCRAPE_DELAY_MS") ?? "2500", 10)
};
