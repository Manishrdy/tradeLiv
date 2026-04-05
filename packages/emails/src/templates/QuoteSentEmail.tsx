import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from '../layouts/BaseLayout';

export interface QuoteSentEmailProps {
  clientName: string;
  designerName: string;
  projectName: string;
  portalUrl: string;
}

export function QuoteSentEmail({
  clientName,
  designerName,
  projectName,
  portalUrl,
}: QuoteSentEmailProps) {
  return (
    <BaseLayout preview={`Your proposal for ${projectName} is ready to review`}>
      <Text style={styles.heading}>Your proposal is ready</Text>
      <Text style={styles.body}>Hi {clientName},</Text>
      <Text style={styles.body}>
        {designerName} has sent you a proposal for <strong>{projectName}</strong>. You can review
        the items, leave comments, and approve or request changes — all in one place.
      </Text>
      <Button style={styles.button} href={portalUrl}>
        Review proposal
      </Button>
      <Text style={styles.hint}>
        This link is unique to you. Do not share it with others.
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
    margin: '8px 0 20px',
  },
  hint: {
    color: '#9ca3af',
    fontSize: '13px',
    lineHeight: '1.5',
    margin: '0',
  },
} as const;
