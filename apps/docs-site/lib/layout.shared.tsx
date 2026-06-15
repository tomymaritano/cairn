import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

/** npm wordmark glyph for the nav icon link. */
function NpmIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      <path d="M2 2h20v20H2V2zm4 4v12h6V9h3v9h3V6H6z" />
    </svg>
  );
}

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
          ▲ Cairn
        </span>
      ),
    },
    githubUrl: "https://github.com/tomymaritano/cairn",
    links: [
      { text: "Docs", url: "/docs", active: "nested-url" },
      {
        type: "icon",
        icon: <NpmIcon />,
        text: "npm",
        url: "https://www.npmjs.com/package/@cairn/react",
        external: true,
      },
    ],
  };
}
