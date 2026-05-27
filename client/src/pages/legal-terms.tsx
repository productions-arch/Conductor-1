import { LegalNav, LegalFooter } from "./legal-privacy";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LegalNav />
      <article className="max-w-2xl mx-auto px-6 py-12">
        <header className="mb-8">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            Legal · Terms
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Terms of Service</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Last updated: May 23, 2026. Operator: Kane Productions, Santa Monica, California.
          </p>
        </header>

        <Section title="Plain-English summary">
          <ul>
            <li>Conductor is in beta and is provided as-is. Things may break.</li>
            <li>You bring and pay for your own model usage via OpenRouter. We don't bill you; we don't fund any credits.</li>
            <li>Don't use Conductor to do illegal things, to harass anyone, or to generate content prohibited by the underlying model providers.</li>
            <li>You own what you generate. We don't claim any rights to your prompts or outputs.</li>
            <li>If we have a dispute, California law applies and we resolve it in Los Angeles County.</li>
          </ul>
        </Section>

        <Section title="1. Acceptance">
          <p>By creating an account or using Conductor, you agree to these Terms and to our <a href="/#/legal/privacy">Privacy Policy</a>. If you do not agree, do not use the service.</p>
        </Section>

        <Section title="2. Beta disclaimer">
          <p>The service is provided "as is" and "as available" during the beta period. We make no warranties, express or implied, including merchantability, fitness for a particular purpose, or non-infringement. We may modify, suspend, or terminate the service at any time without notice. To the maximum extent permitted by law, Kane Productions's liability is limited to fifty US dollars ($50).</p>
        </Section>

        <Section title="3. Accounts">
          <p>You must sign in with Google or Apple to use real models. You are responsible for activity on your account and for keeping your sign-in credentials secure. You must be at least 13 years old. One account per person.</p>
        </Section>

        <Section title="4. BYOK billing">
          <p>Conductor is bring-your-own-key. All model inference is billed by OpenRouter to the credit balance on the OpenRouter account whose API key you provide. Conductor does not bill you, does not fund any starter quota, and is not a party to your OpenRouter contract. You may set a daily spend cap inside Conductor; this is a best-effort safeguard, not a hard guarantee against any specific provider's billing.</p>
        </Section>

        <Section title="5. Acceptable use">
          <p>You agree not to use Conductor:</p>
          <ul>
            <li>to violate any law or regulation;</li>
            <li>to harass, threaten, or harm any person;</li>
            <li>to generate sexual content involving minors, content promoting violence against identifiable groups, or content prohibited by OpenAI, Anthropic, Google, Meta, xAI, DeepSeek, or any other provider's usage policy;</li>
            <li>to reverse-engineer the service or attempt to extract another user's data;</li>
            <li>to send spam, scrape protected content, or otherwise impose unreasonable load on the service.</li>
          </ul>
          <p>We may suspend or terminate accounts that violate these rules.</p>
        </Section>

        <Section title="6. Content ownership">
          <p>You retain all rights to the prompts you send and the outputs you receive. Model providers have their own policies regarding output ownership and usage; please review them. We do not claim any ownership of your content and do not use it to train any model.</p>
        </Section>

        <Section title="7. Termination">
          <p>You may stop using Conductor at any time by signing out and (if you wish) deleting your account by emailing us. We may terminate or suspend your account if you violate these Terms or if we discontinue the service. Upon termination, we will delete your encrypted API key and conversation data within 30 days, except as required for legal compliance.</p>
        </Section>

        <Section title="8. Changes">
          <p>We may update these Terms. When we do, we will update the "Last updated" date and, for material changes, notify you in-app. Continued use after a change constitutes acceptance of the new Terms.</p>
        </Section>

        <Section title="9. Governing law">
          <p>These Terms are governed by the laws of the State of California, without regard to its conflict-of-laws principles. Any dispute will be resolved exclusively in the state or federal courts located in Los Angeles County, California, and you consent to personal jurisdiction there.</p>
        </Section>

        <Section title="10. Contact">
          <p>Questions: <a href="mailto:hello@kaneproductions.com">hello@kaneproductions.com</a>.</p>
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
