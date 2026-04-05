import { Text } from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from '../layouts/BaseLayout';

export interface DesignerSignupEmailProps {
  fullName: string;
}

export function DesignerSignupEmail({ fullName }: DesignerSignupEmailProps) {
  return (
    <BaseLayout preview="Your tradeLiv application is under review">
      <Text style={styles.heading}>Hi {fullName},</Text>
      <Text style={styles.body}>
        Thanks for applying to join tradeLiv! We've received your application and our team will
        review it shortly.
      </Text>
      <Text style={styles.body}>
        You'll receive an email once a decision has been made — usually within 1–2 business days.
      </Text>
      <Text style={styles.body}>In the meantime, feel free to reach out if you have questions.</Text>
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
  signoff: {
    color: '#525252',
    fontSize: '15px',
    lineHeight: '1.7',
    margin: '24px 0 0',
  },
} as const;
