import { Text } from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from '../layouts/BaseLayout';

export interface RejectionEmailProps {
  fullName: string;
  reason?: string | null;
}

export function RejectionEmail({ fullName, reason }: RejectionEmailProps) {
  return (
    <BaseLayout preview="Update on your tradeLiv application">
      <Text style={styles.heading}>Application update</Text>
      <Text style={styles.body}>Hi {fullName},</Text>
      <Text style={styles.body}>
        Thank you for your interest in tradeLiv. After reviewing your application, we're unable to
        approve it at this time.
      </Text>
      {reason && (
        <Text style={styles.reasonBox}>{reason}</Text>
      )}
      <Text style={styles.body}>
        If you have questions or would like more information, please reach out to us at{' '}
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
  reasonBox: {
    backgroundColor: '#F8F7F4',
    borderLeft: '3px solid rgba(158,124,63,0.25)',
    borderRadius: '4px',
    color: '#525252',
    fontSize: '14px',
    lineHeight: '1.6',
    margin: '0 0 20px',
    padding: '12px 16px',
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
