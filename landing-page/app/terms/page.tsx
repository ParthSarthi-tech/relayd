import { Navigation } from '@/components/landing/navigation'
import { FooterSection } from '@/components/landing/footer-section'

export default function TermsPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden noise-overlay">
      <Navigation />
      <div className="max-w-3xl mx-auto px-6 py-24 lg:py-32">
        <h1 className="text-4xl font-display font-bold mb-8">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: June 2026</p>

        <section className="space-y-6 text-muted-foreground leading-relaxed">
          <h2 className="text-xl font-semibold text-foreground mt-10">1. Acceptance of Terms</h2>
          <p>
            By using Relay, you agree to these Terms of Service. If you do not agree, do not
            use the service. We reserve the right to update these terms at any time, and
            continued use constitutes acceptance of changes.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-10">2. Account Registration</h2>
          <p>
            You must provide accurate information when creating an account. You are responsible
            for maintaining the confidentiality of your credentials and for all activity under
            your account. Notify us immediately of any unauthorized use.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-10">3. Acceptable Use</h2>
          <p>
            You agree to use Relay only for lawful purposes and in accordance with these terms.
            You may not use the service to send spam, malware, or illegal content. We reserve
            the right to suspend accounts that violate this policy.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-10">4. Service Limitations</h2>
          <p>
            The service is provided &quot;as is&quot; without warranty of any kind. While we
            strive for high availability and reliability, we do not guarantee uninterrupted
            service. Free tier accounts are subject to usage limits as defined in the pricing
            section.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-10">5. Data Retention</h2>
          <p>
            Webhook delivery logs and payloads are retained according to your plan&apos;s
            retention policy. You may configure custom retention periods. Deleted data is
            permanently removed within 30 days.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-10">6. Limitation of Liability</h2>
          <p>
            Relay shall not be liable for any indirect, incidental, or consequential damages
            arising from the use or inability to use the service, including but not limited to
            lost webhook deliveries or data loss.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-10">7. Termination</h2>
          <p>
            Either party may terminate this agreement at any time. Upon termination, your
            account and associated data will be deleted within 30 days.
          </p>
        </section>
      </div>
      <FooterSection />
    </main>
  )
}
