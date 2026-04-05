import { Text } from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from '../layouts/BaseLayout';

export interface SuspensionEmailProps {
  fullName: string;
}

export function SuspensionEmail({ fullName }: SuspensionEmailProps) {
  return (
    <BaseLayout preview="Your tradeLiv account has been suspended">
      <Text style={styles.heading}>Account suspended</Text>
      <Text style={styles.body}>Hi {fullName},</Text>
      <Text style={styles.body}>
        Your tradeLiv account has been suspended. You will not be able to sign in or access the
        platform until this suspension is resolved.
      </Text>
      <Text style={styles.body}>
        If you believe this was done in error or would like more information, please contact us at{' '}
        <a href="mailto:support@tradeliv.design" style={styles.link}>
          support@tradeliv.design
        </a>
        .
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
