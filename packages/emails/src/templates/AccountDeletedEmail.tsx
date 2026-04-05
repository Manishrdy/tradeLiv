import { Text } from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from '../layouts/BaseLayout';

export interface AccountDeletedEmailProps {
  fullName: string;
}

export function AccountDeletedEmail({ fullName }: AccountDeletedEmailProps) {
  return (
    <BaseLayout preview="Your tradeLiv account has been deleted">
      <Text style={styles.heading}>Goodbye, {fullName.split(' ')[0]}</Text>
      <Text style={styles.body}>Hi {fullName},</Text>
      <Text style={styles.body}>
        Your tradeLiv account has been permanently deleted. All of your data, projects, and associated
        records have been removed from our platform.
      </Text>
      <Text style={styles.body}>
        If you believe this was done in error or have any questions, please reach out to us at{' '}
        <a href="mailto:support@tradeliv.design" style={styles.link}>
          support@tradeliv.design
        </a>
        .
      </Text>
      <Text style={styles.body}>We appreciate the time you spent with us and wish you all the best.</Text>
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
