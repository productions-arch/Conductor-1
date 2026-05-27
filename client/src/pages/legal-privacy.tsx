import { Link } from "wouter";
import { Logo } from "@/components/Logo";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LegalNav />
      <article className="max-w-2xl mx-auto px-6 py-12 prose prose-invert prose-sm">
        <header className="mb-8">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            Legal · Privacy
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Privacy Policy</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Last updated: May 23, 2026. Operator: Kane Productions, Santa Monica, California.
          </p>
        </header>

        <Section title="Plain-English summary">
          <ul>
            <li>You bring your own OpenRouter API key. We encrypt it at rest with AES-256-GCM. We never log it, never send it to anyone except OpenRouter, and never use it to bill you.</li>
            <li>We don't train any model on your data. Conductor is a thin orchestration layer — your prompts go to the providers you select via OpenRouter.</li>
            <li>We store your conversations so you can come back to them. They are encrypted at rest in our database.</li>
            <li>You can delete your account and all associated data at any time by contacting us.</li>
            <li>This is a beta. We expect to ship breaking changes; we will not lose your data without warning.</li>
          </ul>
        </Section>

        <Section title="1. What we collect">
          <p>When you sign in with Google or Apple, we receive your email address, display name, and (where provided) a profile image. We use these only to identify your account and personalize the UI.</p>
          <p>When you save an OpenRouter API key, we store it encrypted with AES-256-GCM using a server-side key that is never exposed to the client. The encrypted ciphertext lives in our Neon Postgres database. We decrypt it transiently in memory at request time to forward to OpenRouter.</p>
          <p>When you send a prompt, we store the messages (prompt + response), the model used, token counts, and computed cost. We do not store anything you do not send to a model.</p>
          <p>We log standard request metadata (timestamps, IP address, user-agent) for security and rate-limiting. These logs are rotated.</p>
        </Section>

        <Section title="2. How we use it">
          <p>We use the data above only to (a) operate the product, (b) display your history back to you, (c) compute and enforce your daily spend cap, and (d) prevent abuse.</p>
          <p>We do not sell your data. We do not share it with advertisers. We do not use it to train any model. We will never send your API key to any party other than OpenRouter.</p>
        </Section>

        <Section title="3. Sub-processors">
          <p>We rely on the following sub-processors:</p>
          <ul>
            <li><strong>Vercel</strong> — application hosting and edge functions. <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer">privacy</a></li>
            <li><strong>Neon</strong> — managed Postgres database. <a href="https://neon.tech/privacy-policy" target="_blank" rel="noreferrer">privacy</a></li>
            <li><strong>OpenRouter</strong> — model routing and inference billing. <a href="https://openrouter.ai/privacy" target="_blank" rel="noreferrer">privacy</a></li>
            <li><strong>Google</strong> — OAuth sign-in. <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">privacy</a></li>
            <li><strong>Apple</strong> — OAuth sign-in (when enabled). <a href="https://www.apple.com/legal/privacy/" target="_blank" rel="noreferrer">privacy</a></li>
          </ul>
          <p>The underlying model providers (OpenAI, Anthropic, Google, Meta, xAI, DeepSeek) receive your prompt content via OpenRouter according to their own privacy policies. Conductor never holds their API keys; we use yours.</p>
        </Section>

        <Section title="4. Data retention">
          <p>We retain conversation data for as long as your account is active. You can delete individual threads from within the app. To delete your account and all associated data, email <a href="mailto:hello@kaneproductions.com">hello@kaneproductions.com</a>. We will process the request within 30 days.</p>
        </Section>

        <Section title="5. Security">
          <p>Your OpenRouter API key is encrypted at rest with AES-256-GCM. The encryption key (server-side) is held only in our hosting environment's secret store and is not accessible to the application bundle or to any browser session. TLS protects all traffic in transit. Sessions use JWT cookies (HTTP-only, Secure, SameSite=Lax) signed with HMAC-SHA256.</p>
          <p>If we discover a security incident affecting your data, we will notify you by email within 72 hours of confirming it.</p>
        </Section>

        <Section title="6. Your rights">
          <p>Depending on your jurisdiction, you may have the right to access, correct, port, or delete your personal data, and to object to certain processing. To exercise any of these rights, email <a href="mailto:hello@kaneproductions.com">hello@kaneproductions.com</a>.</p>
          <p>California residents: you have additional rights under the CCPA, including the right to know what categories of personal information we collect and to request deletion. We do not "sell" personal information under the CCPA's definition.</p>
        </Section>

        <Section title="7. Children">
          <p>Conductor is not directed to children under 13. If we learn that a child under 13 has provided personal information, we will delete it.</p>
        </Section>

        <Section title="8. Changes to this policy">
          <p>We may update this policy. When we do, we will update the "Last updated" date at the top. Material changes will be announced in-app.</p>
        </Section>

        <Section title="9. Contact">
          <p>Questions or concerns: <a href="mailto:hello@kaneproductions.com">hello@kaneproductions.com</a>.</p>
        </Section>
      </article>
      <LegalFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold tracking-tight mb-2">{title}</h2>
      <div className="text-sm text-foreground/85 leading-relaxed space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:underline [&_a]:hover:text-foreground">
        {children}
      </div>
    </section>
  );
}

function LegalNav() {
  return (
    <nav className="border-b border-border sticky top-0 bg-background/80 backdrop-blur z-40">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-4">
        <Link href="/" className="inline-flex items-center gap-2 hover-elevate rounded-md px-1.5 py-1 -ml-1.5">
          <Logo size={18} />
          <span className="font-semibold tracking-tight text-sm">Conductor</span>
        </Link>
        <div className="text-muted-foreground/40">/</div>
        <span className="text-sm">Legal</span>
        <div className="flex-1" />
        <Link href="/legal/privacy" className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover-elevate">Privacy</Link>
        <Link href="/legal/terms" className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover-elevate">Terms</Link>
      </div>
    </nav>
  );
}

function LegalFooter() {
  return (
    <footer className="border-t border-border mt-12">
      <div className="max-w-5xl mx-auto px-6 py-6 text-[11px] text-muted-foreground flex flex-wrap gap-4">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <Link href="/legal/privacy" className="hover:text-foreground">Privacy</Link>
        <Link href="/legal/terms" className="hover:text-foreground">Terms</Link>
        <div className="flex-1" />
        <div>Built by Kane Productions · Santa Monica, CA</div>
      </div>
    </footer>
  );
}

export { LegalNav, LegalFooter };
