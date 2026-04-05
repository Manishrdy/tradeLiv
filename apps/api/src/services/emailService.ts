import nodemailer, { Transporter } from 'nodemailer';
import { ImapFlow, ImapFlowOptions, FetchMessageObject } from 'imapflow';
import { config } from '../config';
import logger from '../config/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
}

export interface FetchedEmail {
  uid: number;
  subject: string | undefined;
  from: string | undefined;
  date: Date | undefined;
  text: string | undefined;
  html: string | undefined;
}

// ─── SMTP Transport ──────────────────────────────────────────────────────────

let _transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (_transporter) return _transporter;

  _transporter = nodemailer.createTransport({
    host: config.email.smtpHost,
    port: config.email.smtpPort,
    secure: config.email.smtpSecure,
    auth: {
      user: config.email.smtpUser,
      pass: config.email.smtpPass,
    },
  });

  return _transporter;
}

/**
 * Verify SMTP connection. Call on app startup to catch misconfiguration early.
 */
export async function verifySmtpConnection(): Promise<void> {
  await getTransporter().verify();
  logger.info('[email] SMTP connection verified');
}

/**
 * Send an email via Zoho SMTP.
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const from = `"${config.email.fromName}" <${config.email.fromAddress}>`;

  try {
    const info = await getTransporter().sendMail({
      from,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      cc: options.cc
        ? Array.isArray(options.cc)
          ? options.cc.join(', ')
          : options.cc
        : undefined,
      replyTo: options.replyTo,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    logger.info('[email] sent', {
      messageId: info.messageId,
      to: options.to,
      subject: options.subject,
    });
  } catch (err) {
    logger.error('[email] send failed', {
      to: options.to,
      subject: options.subject,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// ─── IMAP Client ─────────────────────────────────────────────────────────────

function buildImapOptions(): ImapFlowOptions {
  return {
    host: config.email.imapHost,
    port: config.email.imapPort,
    secure: config.email.imapSecure,
    auth: {
      user: config.email.imapUser,
      pass: config.email.imapPass,
    },
    logger: false, // suppress imapflow's verbose output; we use our own logger
  };
}

/**
 * Fetch recent unseen emails from the INBOX.
 * Opens a short-lived IMAP connection, fetches, then closes.
 */
export async function fetchUnseenEmails(limit = 20): Promise<FetchedEmail[]> {
  const client = new ImapFlow(buildImapOptions());

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    const results: FetchedEmail[] = [];

    try {
      for await (const msg of client.fetch({ seen: false }, { envelope: true, source: true })) {
        if (results.length >= limit) break;
        results.push(parseMessage(msg));
      }
    } finally {
      lock.release();
    }

    logger.info('[email] fetched unseen emails', { count: results.length });
    return results;
  } catch (err) {
    logger.error('[email] IMAP fetch failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    await client.logout();
  }
}

/**
 * Fetch emails from a specific mailbox by UID range or search criteria.
 */
export async function fetchEmailsByMailbox(
  mailbox: string,
  options: { seen?: boolean; limit?: number } = {},
): Promise<FetchedEmail[]> {
  const { seen, limit = 50 } = options;
  const client = new ImapFlow(buildImapOptions());

  try {
    await client.connect();
    const lock = await client.getMailboxLock(mailbox);
    const results: FetchedEmail[] = [];

    try {
      const searchCriteria: Record<string, boolean> = {};
      if (seen !== undefined) {
        searchCriteria[seen ? 'seen' : 'unseen'] = true;
      }

      for await (const msg of client.fetch(
        Object.keys(searchCriteria).length ? searchCriteria : '1:*',
        { envelope: true, source: true },
      )) {
        if (results.length >= limit) break;
        results.push(parseMessage(msg));
      }
    } finally {
      lock.release();
    }

    logger.info('[email] fetched emails from mailbox', { mailbox, count: results.length });
    return results;
  } catch (err) {
    logger.error('[email] IMAP mailbox fetch failed', {
      mailbox,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    await client.logout();
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseMessage(msg: FetchMessageObject): FetchedEmail {
  const envelope = msg.envelope;
  const source = msg.source?.toString('utf-8') ?? '';

  // Extract plain text and HTML from raw source (basic extraction)
  const htmlMatch = source.match(/<html[\s\S]*<\/html>/i);
  const html = htmlMatch ? htmlMatch[0] : undefined;

  // Strip tags for a rough plain-text fallback
  const text = html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : source;

  return {
    uid: msg.uid,
    subject: envelope?.subject,
    from: envelope?.from?.[0]?.address,
    date: envelope?.date,
    text,
    html,
  };
}
