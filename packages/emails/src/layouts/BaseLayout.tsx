import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface BaseLayoutProps {
  preview: string;
  children: React.ReactNode;
}

export function BaseLayout({ preview, children }: BaseLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* ── Header ── */}
          <Section style={styles.header}>
            <Text style={styles.logo}>tradeLiv</Text>
          </Section>

          {/* ── Content ── */}
          <Section style={styles.content}>{children}</Section>

          {/* ── Footer ── */}
          <Hr style={styles.divider} />
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              © {new Date().getFullYear()} tradeLiv. All rights reserved.
            </Text>
            <Text style={styles.footerText}>
              Questions?{' '}
              <a href="mailto:support@tradeliv.design" style={styles.footerLink}>
                support@tradeliv.design
              </a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: '#F8F7F4',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    margin: '0',
    padding: '40px 0',
  },
  container: {
    backgroundColor: '#ffffff',
    border: '1px solid rgba(0,0,0,0.07)',
    borderRadius: '12px',
    maxWidth: '580px',
    margin: '0 auto',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.04)',
  },
  header: {
    backgroundColor: '#111111',
    padding: '28px 40px',
  },
  logo: {
    color: '#ffffff',
    fontSize: '20px',
    fontWeight: '700',
    letterSpacing: '-0.3px',
    margin: '0',
  },
  content: {
    padding: '36px 40px',
  },
  divider: {
    borderColor: 'rgba(0,0,0,0.07)',
    margin: '0 40px',
  },
  footer: {
    padding: '20px 40px 28px',
  },
  footerText: {
    color: '#969696',
    fontSize: '12px',
    lineHeight: '1.5',
    margin: '0 0 4px',
  },
  footerLink: {
    color: '#969696',
    textDecoration: 'underline',
  },
} as const;
