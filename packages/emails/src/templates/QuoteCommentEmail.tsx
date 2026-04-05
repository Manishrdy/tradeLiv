import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from '../layouts/BaseLayout';

export interface QuoteCommentEmailProps {
  recipientName: string;
  senderName: string;
  projectName: string;
  commentText: string;
  actionUrl: string;
}

export function QuoteCommentEmail({
  recipientName,
  senderName,
  projectName,
  commentText,
  actionUrl,
}: QuoteCommentEmailProps) {
  return (
    <BaseLayout preview={`${senderName} left a comment on ${projectName}`}>
      <Text style={styles.heading}>New comment</Text>
      <Text style={styles.body}>Hi {recipientName},</Text>
      <Text style={styles.body}>
        <strong>{senderName}</strong> left a comment on the proposal for{' '}
        <strong>{projectName}</strong>:
      </Text>
      <Text style={styles.commentBox}>{commentText}</Text>
      <Button style={styles.button} href={actionUrl}>
        View comment
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
  commentBox: {
    backgroundColor: '#F8F7F4',
    borderLeft: '3px solid rgba(158,124,63,0.25)',
    borderRadius: '4px',
    color: '#525252',
    fontSize: '14px',
    lineHeight: '1.6',
    margin: '0 0 24px',
    padding: '12px 16px',
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
  },
} as const;
