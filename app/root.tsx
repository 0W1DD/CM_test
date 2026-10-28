import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { AppLayout } from "~/components/app-layout";
import {
  CommunityOwnerLook,
  CommunityThemeInjector,
} from "~/components/community-theme-injector";
import { Snowfall } from "~/components/snowfall";
import { Toaster } from "~/components/ui/sonner";
import { CurrentProfileProvider } from "~/providers/CurrentProfileProvider";
import type { Route } from "./+types/root";
import "./app.css";
import bgForest from "./assets/bg-forest.webp";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - data considered fresh for 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes - keep unused data in cache for 30 minutes
      retry: false,
      refetchOnWindowFocus: false, // Don't refetch on window focus to reduce network requests
      refetchOnMount: false, // Don't refetch on component mount if data is fresh
    },
  },
});

export function meta() {
  return [
    { title: "커뮹!" },
    { name: "description", content: "커뮹! 커뮤 플랫폼" },
  ];
}

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://cdn.jsdelivr.net", crossOrigin: "anonymous" },
  // Pretendard: a Korean UI face built for screens, loaded as a subset. It
  // covers every glyph the pages use.
  {
    rel: "stylesheet",
    href: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css",
  },
  // Gowun Batang: a gentle serif for titles and quotes only.
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <div
          className="bg-photo"
          aria-hidden
          style={{
            backgroundImage: `linear-gradient(color-mix(in srgb, var(--ground) 18%, transparent), color-mix(in srgb, var(--ground) 18%, transparent)), url(${bgForest})`,
          }}
        />
        <Snowfall />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster />
          <ScrollRestoration />
          <Scripts />
        </ThemeProvider>
      </body>
    </html>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CommunityThemeInjector />
      <CommunityOwnerLook />
      <CurrentProfileProvider>
        <AppLayout>
          <Outlet />
        </AppLayout>
      </CurrentProfileProvider>
    </QueryClientProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "앗!";
  let details = "예상치 못한 오류가 발생했습니다.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "오류";
    details =
      error.status === 404
        ? "요청한 페이지를 찾을 수 없습니다."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
