import { NotFound } from "@rebask/core/components/errors";

export default function MissingPage() {
  return <NotFound><main className="setup"><div className="setup-card">
    <span className="eyebrow">SLIDEX / 404</span>
    <h1>This page could not be found.</h1>
    <a href="/">Return to Slidex →</a>
  </div></main></NotFound>;
}
