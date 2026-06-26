import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { useRoutes } from 'react-router-dom';
import { routes } from './routes';

function App() {
  return useRoutes(routes);
}

/** Renders a route to a static HTML string for SEO prerendering (no hydration). */
export function render(url: string): string {
  return renderToString(
    <StaticRouter location={url}>
      <App />
    </StaticRouter>,
  );
}
