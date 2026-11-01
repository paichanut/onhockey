export const metadata = {
  title: 'Privacy policy · Ice Hockey TV Guide',
  description: 'What Ice Hockey TV Guide collects and why.',
};

export default function PrivacyPage() {
  return (
    <main className="wrap privacy">
      <h1>Privacy policy</h1>
      <p className="note">Ice Hockey TV Guide (app and website) · Last updated 1 November 2026</p>

      <h2>What the app does</h2>
      <p>
        Ice Hockey TV Guide lists live and upcoming ice hockey streams that YouTube channels have made public. It
        has no accounts and no sign-in, and it never asks for your name, email, contacts, photos or location.
      </p>

      <h2>Usage statistics</h2>
      <p>To see how many people use the guide and which streams are popular, the guide uses:</p>
      <ul>
        <li>
          <b>Google Analytics</b>: the pages you view, the streams you open, and basic device information (device
          type, operating system, browser, screen size, language) with an approximate location derived from your IP
          address. Google Analytics stores a pseudonymous identifier on your device. See{' '}
          <a href="https://policies.google.com/technologies/partner-sites">how Google uses this data</a>.
        </li>
        <li>
          <b>Vercel Web Analytics</b>: anonymous page-view counts, without cookies or identifiers.
        </li>
      </ul>
      <p>This data is used only to improve the guide. It is not sold, and it is not used for advertising.</p>

      <h2>YouTube and Google Calendar</h2>
      <p>
        Opening a stream hands it to the YouTube app or website, and &quot;Add to Google Calendar&quot; opens
        Google Calendar with the event filled in. Those services are run by Google under the{' '}
        <a href="https://policies.google.com/privacy">Google Privacy Policy</a>; the guide does not receive anything
        you do there.
      </p>

      <h2>Children</h2>
      <p>The guide is not directed at children under 13 and does not knowingly collect their data.</p>

      <h2>Deleting your data</h2>
      <p>
        The guide keeps no personal data of its own. To clear the analytics identifier, clear the app&apos;s storage
        (Android Settings → Apps → Ice Hockey TV Guide → Storage → Clear storage) or uninstall the app.
      </p>

      <h2>Contact</h2>
      <p>Questions about this policy: use the developer email shown on the app&apos;s Google Play page.</p>

      <p><a href="/">← Back to the guide</a></p>
    </main>
  );
}
