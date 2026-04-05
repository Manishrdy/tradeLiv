import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from '../layouts/BaseLayout';

export interface EmailVerificationEmailProps {
  fullName: string;
  verificationUrl: string;
}

export function EmailVerificationEmail({ fullName, verificationUrl }: EmailVerificationEmailProps) {
  return (
    <BaseLayout preview="Verify your email to submit your tradeLiv application">
      <Text style={styles.heading}>Verify your email address</Text>
      <Text style={styles.body}>Hi {fullName},</Text>
      <Text style={styles.body}>
        Thanks for applying to tradeLiv. Click the button below to verify your email address and
        submit your application for review. This link expires in 24 hours.
      </Text>
      <Button style={styles.button} href={verificationUrl}>
        Verify email address
      </Button>
      <Text style={styles.note}>
        If you didn&apos;t create a tradeLiv account, you can safely ignore this email.
      </Text>
      <Text style={styles.signoff}>
        The tradeLiv team
      </Text>
    </BaseLayout>
  );
}

const styles = {
  heading: {
    color: '#111111',
    fontSize: '20px',
    fontWeight: '600',
    margin: '0 0 20px',
  },
  body: {
    color: '#525252',
    fontSize: '15px',
    lineHeight: '1.7',
    margin: '0 0 16px',
  },
  button: {
    backgroundColor: '#111111',
    borderRadius: '6px',
    color: '#ffffff',
    display: 'inline-block',
    fontSize: '14px',
    fontWeight: '600',
    padding: '12px 24px',
    textDecoration: 'none',
    margin: '8px 0 28px',
  },
  note: {
    color: '#a3a3a3',
    fontSize: '13px',
    lineHeight: '1.6',
    margin: '0 0 16px',
  },
  signoff: {
    color: '#525252',
    fontSize: '15px',
    lineHeight: '1.7',
    margin: '0',
  },
} as const;
