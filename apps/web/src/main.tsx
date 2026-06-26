import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { routes } from './routes';

// Self-hosted Inter (replaces next/font/google). globals.css references `font-family: Inter`.
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/inter/900.css';

import './app/globals.css';

const router = createBrowserRouter(routes);

createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />);
