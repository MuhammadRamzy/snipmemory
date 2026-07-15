import { NextResponse } from 'next/server';

export function middleware(request) {
  const url = request.nextUrl.clone();
  const host = request.headers.get('host') || '';

  // Check if host starts with 'admin.'
  const isAdminDomain = host.toLowerCase().startsWith('admin.');

  // Enforce separate domain for admin panel
  if (url.pathname.startsWith('/admin')) {
    if (!isAdminDomain) {
      // Return a beautiful HTML error page explaining the subdomain restriction
      return new NextResponse(
        `<!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Access Restricted - SnipMemory Admin</title>
            <style>
              :root {
                --bg: #0d0d11;
                --card-bg: #16161f;
                --border: #262633;
                --text: #e4e4e7;
                --muted: #8b8b9c;
                --accent: #f43f5e;
                --accent-soft: rgba(244, 63, 94, 0.1);
                --link: #3b82f6;
              }
              body {
                background-color: var(--bg);
                color: var(--text);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                padding: 1.5rem;
                box-sizing: border-box;
              }
              .restricted-card {
                background-color: var(--card-bg);
                border: 1px solid var(--border);
                border-radius: 16px;
                padding: 2.5rem 2rem;
                max-width: 480px;
                width: 100%;
                text-align: center;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                animation: scaleIn 0.3s ease-out;
              }
              @keyframes scaleIn {
                from { transform: scale(0.95); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
              }
              .icon-container {
                display: inline-flex;
                padding: 1rem;
                border-radius: 50%;
                background-color: var(--accent-soft);
                color: var(--accent);
                margin-bottom: 1.5rem;
              }
              h1 {
                font-size: 1.5rem;
                font-weight: 700;
                margin: 0 0 1rem 0;
                color: var(--text);
              }
              p {
                color: var(--muted);
                font-size: 0.9375rem;
                line-height: 1.6;
                margin: 0 0 1.5rem 0;
              }
              .url-box {
                background: #09090d;
                border: 1px solid var(--border);
                padding: 0.75rem 1rem;
                border-radius: 8px;
                font-family: monospace;
                font-size: 1rem;
                margin-bottom: 1.5rem;
                word-break: break-all;
              }
              .url-box a {
                color: var(--link);
                text-decoration: none;
                font-weight: 600;
              }
              .url-box a:hover {
                text-decoration: underline;
              }
              .badge {
                font-size: 0.75rem;
                background-color: #27272a;
                color: #d4d4d8;
                padding: 0.25rem 0.5rem;
                border-radius: 4px;
                font-family: monospace;
              }
            </style>
          </head>
          <body>
            <div class="restricted-card">
              <div class="icon-container">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <h1>Subdomain Isolation Required</h1>
              <p>
                The SnipMemory Platform Administration Portal is restricted to the dedicated administrative subdomain. Access from the primary tenant domain is locked.
              </p>
              <p>Please use the designated address to manage the platform:</p>
              <div class="url-box">
                <a href="http://admin.localhost:3000/admin">http://admin.localhost:3000/admin</a>
              </div>
              <p style="font-size: 0.8125rem; margin-bottom: 0;">
                <span class="badge">*.localhost</span> resolves automatically to local loopback in modern browsers.
              </p>
            </div>
          </body>
        </html>`,
        {
          status: 403,
          headers: { 'content-type': 'text/html' }
        }
      );
    }
  }

  // If on admin subdomain and accessing home page, redirect or rewrite to admin login/dashboard
  if (isAdminDomain && url.pathname === '/') {
    url.pathname = '/admin';
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|App.css|globals.css|index.css).*)',
  ],
};
