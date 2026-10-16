'use client';

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-8 py-12 sm:px-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500 mb-8">
            Last updated: July 2026 · NZ Marie (Marie Nian, Barfoot &amp; Thompson)
          </p>

          <p className="text-gray-600 text-sm leading-relaxed mb-8">
            Marie Nian (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your personal information in accordance with the Privacy Act 2020 (New Zealand). We value your trust and ensure that any information you share with us is handled with care, transparency, and respect.
          </p>

          <hr className="border-gray-100 my-8" />

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">1. Information We Collect</h2>
            <p className="text-gray-600 text-sm leading-relaxed mb-3">
              We may collect personal information from you in the following ways:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
              <li>
                <strong>Contact Information:</strong> Your name, email address, and phone number when you request a property appraisal, download market reports, or get in touch with us.
              </li>
              <li>
                <strong>Property Details:</strong> Your property address when you submit an appraisal request.
              </li>
              <li>
                <strong>Website &amp; Campaign Analytics:</strong> Standard, anonymised browsing information (such as device type and general regional data) when you visit our website or scan a campaign QR code. This data is collected purely to ensure our website functions smoothly and to measure campaign reach. It cannot be used to identify you personally.
              </li>
            </ul>
          </section>

          <hr className="border-gray-100 my-8" />

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">2. Purpose of Collection</h2>
            <p className="text-gray-600 text-sm leading-relaxed mb-3">
              We collect your personal information to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-gray-600 leading-relaxed mb-4">
              <li>Provide you with requested property appraisals and localized market reports.</li>
              <li>Keep you updated with relevant local real estate insights in your neighbourhood.</li>
              <li>Understand the effectiveness of our local community marketing efforts.</li>
            </ul>
            <p className="text-gray-600 text-sm leading-relaxed">
              You are under no obligation to provide personal information. However, choosing not to may limit our ability to provide specific customized services or reports.
            </p>
          </section>

          <hr className="border-gray-100 my-8" />

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">3. Data Protection &amp; Zero-Spam Promise</h2>
            <p className="text-gray-600 text-sm leading-relaxed mb-4">
              Your information is stored securely using industry-standard protection measures.
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
              <li>
                <strong>No Selling or Renting:</strong> We will <strong>never sell, rent, or share</strong> your personal information with third parties for marketing purposes.
              </li>
              <li>
                <strong>Trusted Service Providers:</strong> Access to data is restricted strictly to support technologies (such as secure web hosting platforms) under strict confidentiality obligations.
              </li>
            </ul>
          </section>

          <hr className="border-gray-100 my-8" />

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">4. Data Retention</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              We retain personal information and campaign analytics only for as long as necessary to fulfil the operational purposes described above, or as required by New Zealand law. Once no longer required, data is securely deleted or anonymized.
            </p>
          </section>

          <hr className="border-gray-100 my-8" />

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">5. Your Rights &amp; Control</h2>
            <p className="text-gray-600 text-sm leading-relaxed mb-3">
              Under the Privacy Act 2020, you have full control over your personal data. You have the right to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-gray-600 leading-relaxed mb-6">
              <li>Request a copy of any personal information we hold about you.</li>
              <li>Request the correction or complete deletion of your personal information at any time.</li>
            </ul>
            <p className="text-gray-600 text-sm leading-relaxed mb-4">
              If you have any questions about this policy or wish to update your preferences, please contact:
            </p>
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 text-sm text-gray-700 space-y-1">
              <p className="font-bold text-gray-900">Marie Nian</p>
              <p className="text-gray-600">Residential Sales | Barfoot &amp; Thompson</p>
              <p>
                📧 Email:{' '}
                <a href="mailto:m.nian@barfoot.co.nz" className="text-blue-600 hover:underline font-medium">
                  m.nian@barfoot.co.nz
                </a>
              </p>
              <p>
                📱 Phone:{' '}
                <a href="tel:+64210693089" className="text-blue-600 hover:underline font-medium">
                  021 069 3089
                </a>
              </p>
            </div>
          </section>

          <div className="border-t border-gray-100 pt-8 mt-12 text-center">
            <button
              onClick={() => window.close()}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              ← Close this tab
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
