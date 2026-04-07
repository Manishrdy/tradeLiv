import { Text, Section } from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from '../layouts/BaseLayout';

export interface PasswordChangeOtpEmailProps {
  fullName: string;
  otp: string;
}

export function PasswordChangeOtpEmail({ fullName, otp }: PasswordChangeOtpEmailProps) {
  return (
    <BaseLayout preview="Your verification code to confirm the password change is inside.">
      <Text style={styles.heading}>Verify your password change</Text>
      <Text style={styles.body}>Hi {fullName},</Text>
      <Text style={styles.body}>
        We received a request to change your tradeLiv account password. Use the code below to
        confirm.
      </Text>

      <Section style={styles.codeBox}>
        <Text style={styles.code}>{otp}</Text>
        <Text style={styles.codeNote}>Valid for 10 minutes</Text>
      </Section>

      <Text style={styles.body}>
        If you did not request a password change, you can safely ignore this email. Your password
        will remain unchanged.
      </Text>
      <Text style={styles.signoff}>The tradeLiv team</Text>
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
  codeBox: {
    background: '#F8F7F4',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: '10px',
    padding: '24px 0',
    textAlign: 'center' as const,
    margin: '8px 0 24px',
  },
  code: {
    color: '#111111',
    fontSize: '38px',
    fontWeight: '700',
    letterSpacing: '12px',
    margin: '0 0 6px',
    fontFamily: 'monospace',
  },
  codeNote: {
    color: '#969696',
    fontSize: '12px',
    margin: '0',
  },
  signoff: {
    color: '#525252',
    fontSize: '15px',
    lineHeight: '1.7',
    margin: '24px 0 0',
  },
} as const;
