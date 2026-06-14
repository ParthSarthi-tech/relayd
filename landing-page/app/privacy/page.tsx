import { Navigation } from '@/components/landing/navigation'
import { FooterSection } from '@/components/landing/footer-section'

export default function PrivacyPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden noise-overlay">
      <Navigation />
      <div className="max-w-3xl mx-auto px-6 py-24 lg:py-32">
        <h1 className="text-4xl font-display font-bold mb-8">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: June 2026</p>

        <section className="space-y-6 text-muted-foreground leading-relaxed">
          <h2 className="text-xl font-semibold text-foreground mt-10">1. Information We Collect</h2>
          <p>
            We collect information you provide when creating an account, including your name,
            email address, and organization name. When you use our webhook delivery service,
            we process and store webhook payloads, delivery logs, and configuration data
            necessary to operate the service.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-10">2. How We Use Your Information</h2>
          <p>
            Your information is used solely to provide and improve the Relay webhook delivery
            service. This includes processing webhook deliveries, maintaining service reliability,
            debugging delivery failures, and communicating service updates.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-10">3. Data Storage and Security</h2>
          <p>
            All data is stored securely using PostgreSQL and Redis. We implement encryption at
            rest and in transit. Webhook payloads are retained according to your configured
            retention policy and permanently deleted after the retention period expires.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-10">4. Data Sharing</h2>
          <p>
            We do not sell your personal data. We do not share webhook payloads with third
            parties. Infrastructure providers (database and cache services) have access only
            to encrypted data necessary for service operation.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-10">5. Your Rights</h2>
          <p>
            You may request access to, correction of, or deletion of your personal data at any
            time. Account deletion will remove all associated data including webhook
            configurations and delivery logs within 30 days.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-10">6. Contact</h2>
          <p>
            For privacy-related inquiries, please contact the service administrator.
          </p>
        </section>
      </div>
      <FooterSection />
    </main>
  )
}
