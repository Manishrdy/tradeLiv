import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from '../layouts/BaseLayout';

export interface ApprovalEmailProps {
  fullName: string;
  loginUrl: string;
}

export function ApprovalEmail({ fullName, loginUrl }: ApprovalEmailProps) {
  return (
    <BaseLayout preview="Your tradeLiv application has been approved!">
      <Text style={styles.heading}>You're approved!</Text>
      <Text style={styles.body}>Hi {fullName},</Text>
      <Text style={styles.body}>
        Great news — your tradeLiv application has been approved. You can now sign in and start
        using the platform to manage clients, create proposals, and source furniture.
      </Text>
      <Button style={styles.button} href={loginUrl}>
        Sign in to tradeLiv
      </Button>
      <Text style={styles.signoff}>
        Welcome aboard,
        <br />
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
  signoff: {
    color: '#525252',
    fontSize: '15px',
    lineHeight: '1.7',
    margin: '0',
  },
} as const;
