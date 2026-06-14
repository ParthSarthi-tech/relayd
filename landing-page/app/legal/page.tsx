import { Navigation } from '@/components/landing/navigation'
import { FooterSection } from '@/components/landing/footer-section'

export default function LegalPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden noise-overlay">
      <Navigation />
      <div className="max-w-3xl mx-auto px-6 py-24 lg:py-32">
        <h1 className="text-4xl font-display font-bold mb-8">Legal</h1>
        <p className="text-muted-foreground mb-8">
          This page contains legal information about the Relay webhook delivery service.
        </p>

        <section className="space-y-6 text-muted-foreground leading-relaxed">
          <h2 className="text-xl font-semibold text-foreground mt-10">Service Overview</h2>
          <p>
            Relay is a webhook delivery infrastructure service. By using this service, you
            agree to our Terms of Service and Privacy Policy, which govern your use of the
            platform.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-10">Governing Law</h2>
          <p>
            These terms are governed by the laws of India. Any disputes arising from the use
            of this service shall be resolved in the courts of India.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-10">Contact Information</h2>
          <p>
            For legal inquiries, please reach out to the service administrator. We aim to
            respond to all inquiries within 5 business days.
          </p>

          <div className="mt-8 flex gap-4">
            <a
              href="/privacy"
              className="text-sm text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href="/terms"
              className="text-sm text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
            >
              Terms of Service
            </a>
          </div>
        </section>
      </div>
      <FooterSection />
    </main>
  )
}
