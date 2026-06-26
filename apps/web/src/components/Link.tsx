import { forwardRef } from 'react';
import { Link as RouterLink, type LinkProps as RouterLinkProps } from 'react-router-dom';

/**
 * Drop-in replacement for `next/link`. Maps Next's `href` prop to react-router's
 * `to`, and swallows Next-only props (`prefetch`, `replace` is supported) so they
 * don't leak onto the DOM. Lets the rest of the app keep `<Link href=...>` unchanged.
 */
type Props = Omit<RouterLinkProps, 'to'> & {
  href: RouterLinkProps['to'];
  prefetch?: boolean;
  scroll?: boolean;
  shallow?: boolean;
};

const Link = forwardRef<HTMLAnchorElement, Props>(function Link(
  { href, prefetch: _p, scroll: _s, shallow: _sh, ...rest },
  ref,
) {
  return <RouterLink ref={ref} to={href} {...rest} />;
});

export default Link;
