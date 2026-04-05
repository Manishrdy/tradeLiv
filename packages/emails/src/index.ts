import { render } from '@react-email/render';
import * as React from 'react';

import { AdminNewApplicationEmail } from './templates/AdminNewApplicationEmail';
import { EmailVerificationEmail } from './templates/EmailVerificationEmail';
import { ApprovalEmail } from './templates/ApprovalEmail';
import { DesignerSignupEmail } from './templates/DesignerSignupEmail';
import { PasswordChangedEmail } from './templates/PasswordChangedEmail';
import { QuoteApprovedEmail } from './templates/QuoteApprovedEmail';
import { QuoteCommentEmail } from './templates/QuoteCommentEmail';
import { QuoteRevisionEmail } from './templates/QuoteRevisionEmail';
import { QuoteSentEmail } from './templates/QuoteSentEmail';
import { RejectionEmail } from './templates/RejectionEmail';
import { SuspensionEmail } from './templates/SuspensionEmail';
import { AccountDeletedEmail } from './templates/AccountDeletedEmail';

import type { AdminNewApplicationEmailProps } from './templates/AdminNewApplicationEmail';
import type { EmailVerificationEmailProps } from './templates/EmailVerificationEmail';
import type { ApprovalEmailProps } from './templates/ApprovalEmail';
import type { DesignerSignupEmailProps } from './templates/DesignerSignupEmail';
import type { PasswordChangedEmailProps } from './templates/PasswordChangedEmail';
import type { QuoteApprovedEmailProps } from './templates/QuoteApprovedEmail';
import type { QuoteCommentEmailProps } from './templates/QuoteCommentEmail';
import type { QuoteRevisionEmailProps } from './templates/QuoteRevisionEmail';
import type { QuoteSentEmailProps } from './templates/QuoteSentEmail';
import type { RejectionEmailProps } from './templates/RejectionEmail';
import type { SuspensionEmailProps } from './templates/SuspensionEmail';
import type { AccountDeletedEmailProps } from './templates/AccountDeletedEmail';

export interface RenderedEmail {
  subject: string;
  html: string;
}

export async function renderEmailVerificationEmail(
  props: EmailVerificationEmailProps,
): Promise<RenderedEmail> {
  return {
    subject: 'Verify your email — tradeLiv',
    html: await render(React.createElement(EmailVerificationEmail, props)),
  };
}

export async function renderDesignerSignupEmail(
  props: DesignerSignupEmailProps,
): Promise<RenderedEmail> {
  return {
    subject: 'Your tradeLiv application is under review',
    html: await render(React.createElement(DesignerSignupEmail, props)),
  };
}

export async function renderAdminNewApplicationEmail(
  props: AdminNewApplicationEmailProps,
): Promise<RenderedEmail> {
  return {
    subject: `New designer application — ${props.fullName}`,
    html: await render(React.createElement(AdminNewApplicationEmail, props)),
  };
}

export async function renderPasswordChangedEmail(
  props: PasswordChangedEmailProps,
): Promise<RenderedEmail> {
  return {
    subject: 'Your tradeLiv password was changed',
    html: await render(React.createElement(PasswordChangedEmail, props)),
  };
}

export async function renderApprovalEmail(props: ApprovalEmailProps): Promise<RenderedEmail> {
  return {
    subject: 'Your tradeLiv application has been approved!',
    html: await render(React.createElement(ApprovalEmail, props)),
  };
}

export async function renderRejectionEmail(props: RejectionEmailProps): Promise<RenderedEmail> {
  return {
    subject: 'Update on your tradeLiv application',
    html: await render(React.createElement(RejectionEmail, props)),
  };
}

export async function renderSuspensionEmail(props: SuspensionEmailProps): Promise<RenderedEmail> {
  return {
    subject: 'Your tradeLiv account has been suspended',
    html: await render(React.createElement(SuspensionEmail, props)),
  };
}

export async function renderAccountDeletedEmail(
  props: AccountDeletedEmailProps,
): Promise<RenderedEmail> {
  return {
    subject: 'Your tradeLiv account has been deleted',
    html: await render(React.createElement(AccountDeletedEmail, props)),
  };
}

export async function renderQuoteSentEmail(props: QuoteSentEmailProps): Promise<RenderedEmail> {
  return {
    subject: `Your proposal for ${props.projectName} is ready to review`,
    html: await render(React.createElement(QuoteSentEmail, props)),
  };
}

export async function renderQuoteApprovedEmail(
  props: QuoteApprovedEmailProps,
): Promise<RenderedEmail> {
  return {
    subject: `${props.clientName} approved ${props.quoteTitle || 'your quote'} — ${props.projectName}`,
    html: await render(React.createElement(QuoteApprovedEmail, props)),
  };
}

export async function renderQuoteRevisionEmail(
  props: QuoteRevisionEmailProps,
): Promise<RenderedEmail> {
  return {
    subject: `${props.clientName} requested changes — ${props.projectName}`,
    html: await render(React.createElement(QuoteRevisionEmail, props)),
  };
}

export async function renderQuoteCommentEmail(
  props: QuoteCommentEmailProps,
): Promise<RenderedEmail> {
  return {
    subject: `New comment on ${props.projectName} from ${props.senderName}`,
    html: await render(React.createElement(QuoteCommentEmail, props)),
  };
}
