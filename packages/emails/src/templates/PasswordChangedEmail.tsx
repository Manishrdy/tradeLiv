import { Text } from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from '../layouts/BaseLayout';

export interface PasswordChangedEmailProps {
  fullName: string;
}

export function PasswordChangedEmail({ fullName }: PasswordChangedEmailProps) {
  return (
    <BaseLayout preview="Your tradeLiv password was changed">
      <Text style={styles.heading}>Password changed</Text>
      <Text style={styles.body}>Hi {fullName},</Text>
      <Text style={styles.body}>
        Your tradeLiv account password was recently changed. If you made this change, no action is
        needed.
      </Text>
      <Text style={styles.body}>
        If you did <strong>not</strong> make this change, please contact us immediately at{' '}
        <a href="mailto:support@tradeliv.design" style={styles.link}>
          support@tradeliv.design
        </a>{' '}
        so we can secure your account.
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
  link: {
    color: '#9E7C3F',
    textDecoration: 'underline',
  },
  signoff: {
    color: '#525252',
    fontSize: '15px',
    lineHeight: '1.7',
    margin: '24px 0 0',
  },
} as const;
