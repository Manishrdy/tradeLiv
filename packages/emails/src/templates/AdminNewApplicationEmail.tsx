import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from '../layouts/BaseLayout';

export interface AdminNewApplicationEmailProps {
  fullName: string;
  email: string;
  businessName?: string | null;
  city: string;
  state: string;
  adminUrl: string;
}

export function AdminNewApplicationEmail({
  fullName,
  email,
  businessName,
  city,
  state,
  adminUrl,
}: AdminNewApplicationEmailProps) {
  return (
    <BaseLayout preview={`New designer application from ${fullName}`}>
      <Text style={styles.heading}>New designer application</Text>
      <Text style={styles.body}>A new designer has applied to join tradeLiv.</Text>

      <table style={styles.detailTable}>
        <tbody>
          <tr>
            <td style={styles.label}>Name</td>
            <td style={styles.value}>{fullName}</td>
          </tr>
          <tr>
            <td style={styles.label}>Email</td>
            <td style={styles.value}>{email}</td>
          </tr>
          {businessName && (
            <tr>
              <td style={styles.label}>Business</td>
              <td style={styles.value}>{businessName}</td>
            </tr>
          )}
          <tr>
            <td style={styles.label}>Location</td>
            <td style={styles.value}>
              {city}, {state}
            </td>
          </tr>
        </tbody>
      </table>

      <Button style={styles.button} href={adminUrl}>
        Review application
      </Button>
    </BaseLayout>
  );
}

const styles = {
  heading: {
    color: '#111111',
    fontSize: '20px',
    fontWeight: '600',
    margin: '0 0 16px',
  },
  body: {
    color: '#525252',
    fontSize: '15px',
    lineHeight: '1.7',
    margin: '0 0 20px',
  },
  detailTable: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    marginBottom: '28px',
  },
  label: {
    color: '#969696',
    fontSize: '13px',
    fontWeight: '600',
    padding: '6px 16px 6px 0',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    width: '100px',
  },
  value: {
    color: '#111111',
    fontSize: '15px',
    padding: '6px 0',
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
