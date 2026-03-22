export const config = {
  get port() { return Number(process.env.API_PORT) || 4000; },
  get jwtSecret() { return process.env.JWT_SECRET!; },
  get jwtExpiresIn() { return process.env.JWT_EXPIRES_IN || '7d'; },
  get frontendUrl() { return process.env.FRONTEND_URL || 'http://localhost:3000'; },
  get claudeApiKey() { return process.env.CLAUDE_API_KEY!; },
  get stripeSecretKey() { return process.env.STRIPE_SECRET_KEY!; },
  get stripeWebhookSecret() { return process.env.STRIPE_WEBHOOK_SECRET!; },
  get browserWsEndpoint() { return process.env.BROWSER_WS_ENDPOINT || ''; },
};
