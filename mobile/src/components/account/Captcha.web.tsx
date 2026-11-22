/**
 * The browser version of the app sends steps that need the captcha to the
 * website itself (see web-sign-in.ts), so this window is never shown there.
 */
export function Captcha(_props: { visible: boolean; onToken: (token: string) => void; onCancel: () => void }) {
  return null;
}
