type IconName = "github" | "linkedin" | "x" | "web";

function LinkIcon({ name }: { name: IconName }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "github" ? <path d="M9 19c-4.5 1.4-4.5-2.3-6-2.8M15 22v-3.9c0-1.1-.4-1.8-.9-2.2 3-.3 6.2-1.5 6.2-6.8 0-1.5-.5-2.7-1.4-3.7.2-.4.6-1.8-.1-3.6 0 0-1.1-.4-3.8 1.4a13 13 0 0 0-6 0C6.3 1.4 5.2 1.8 5.2 1.8c-.7 1.8-.3 3.2-.1 3.6A5.4 5.4 0 0 0 3.7 9c0 5.3 3.2 6.5 6.2 6.8-.5.4-.9 1.2-.9 2.2V22" />
      : name === "linkedin" ? <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M7.5 10v7M7.5 7v.1M11.5 17v-7m0 3a3 3 0 0 1 6 0v4" /></>
      : name === "x" ? <><path d="m4 3 12 18h4L8 3H4Z" /><path d="m20 3-6.9 8M4 21l6.9-8" /></>
      : <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>}
  </svg>;
}

export function SourceLink({ label }: { label: string }) {
  return <a className="landing-source" href="https://github.com/hipdev/slidex" target="_blank" rel="noopener noreferrer">
    <LinkIcon name="github" /><span>{label}</span><span aria-hidden="true">↗</span>
  </a>;
}

export function CreatorLinks({ label, navigationLabel }: { label: string; navigationLabel: string }) {
  return <footer className="landing-creator">
    <span>{label} <strong>Julián David</strong></span>
    <nav aria-label={navigationLabel}>
      {([
        ["web", "julianux.com", "https://www.julianux.com/"],
        ["github", "GitHub", "https://github.com/hipdev"],
        ["linkedin", "LinkedIn", "https://linkedin.com/in/hipdev"],
        ["x", "X", "https://x.com/hipdev_"],
      ] as const).map(([icon, text, href]) => <a key={icon} href={href} target="_blank" rel="noopener noreferrer"><LinkIcon name={icon} /><span>{text}</span></a>)}
    </nav>
  </footer>;
}
