import { Layout } from "@/components/layout";

export default function PrivacyPolicy() {
  return (
    <Layout title="Privacy Policy" showBackButton>
      <div className="max-w-3xl mx-auto prose dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: January 2026</p>

        <h2>1. Introduction</h2>
        <p>
          Welcome to RentEdge ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our rent management application.
        </p>

        <h2>2. Information We Collect</h2>
        <p>We collect the following types of information:</p>
        <ul>
          <li><strong>Account Information:</strong> Phone number, name, and password when you create an account</li>
          <li><strong>Property Information:</strong> Property details, addresses, rent amounts, and tenant/owner relationships</li>
          <li><strong>Payment Information:</strong> Payment records, transaction IDs, and payment proof images</li>
          <li><strong>Usage Data:</strong> How you interact with our application</li>
        </ul>

        <h2>3. How We Use Your Information</h2>
        <p>We use your information to:</p>
        <ul>
          <li>Provide and maintain our rent management services</li>
          <li>Process and track rent payments</li>
          <li>Connect property owners with tenants</li>
          <li>Send notifications about payment due dates and status</li>
          <li>Improve our application and user experience</li>
          <li>Ensure security and prevent fraud</li>
        </ul>

        <h2>4. Data Storage and Security</h2>
        <p>
          Your data is stored securely on cloud servers. We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
        </p>

        <h2>5. Data Sharing</h2>
        <p>We do not sell your personal information. We may share your information only:</p>
        <ul>
          <li>Between property owners and their tenants as necessary for rent management</li>
          <li>With service providers who assist in operating our application</li>
          <li>When required by law or to protect our legal rights</li>
        </ul>

        <h2>6. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access your personal data</li>
          <li>Correct inaccurate data</li>
          <li>Request deletion of your data</li>
          <li>Withdraw consent at any time</li>
        </ul>

        <h2>7. Data Retention</h2>
        <p>
          We retain your personal information for as long as your account is active or as needed to provide services. Payment records are retained for accounting and legal compliance purposes.
        </p>

        <h2>8. Children's Privacy</h2>
        <p>
          Our application is not intended for users under 18 years of age. We do not knowingly collect information from children.
        </p>

        <h2>9. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of any changes by updating the "Last updated" date.
        </p>

        <h2>10. Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy or our data practices, please contact us through the application.
        </p>
      </div>
    </Layout>
  );
}
