import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from '../layouts/BaseLayout';

export interface QuoteRevisionEmailProps {
  designerName: string;
  clientName: string;
  projectName: string;
  quoteTitle?: string | null;
  dashboardUrl: string;
}

export function QuoteRevisionEmail({
  designerName,
  clientName,
  projectName,
  quoteTitle,
  dashboardUrl,
}: QuoteRevisionEmailProps) {
  const label = quoteTitle || 'your quote';

  return (
    <BaseLayout preview={`${clientName} requested changes to ${label}`}>
      <Text style={styles.heading}>Revision requested</Text>
      <Text style={styles.body}>Hi {designerName},</Text>
      <Text style={styles.body}>
        <strong>{clientName}</strong> has requested changes to {label} for the project{' '}
        <strong>{projectName}</strong>. Check their comments and update the quote when ready.
      </Text>
      <Button style={styles.button} href={dashboardUrl}>
        View in dashboard
      </Button>
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
    margin: '8px 0 0',
  },
} as const;
