import type { HybridObject } from 'react-native-nitro-modules'

/**
 * The outcome of a {@link NitroGoogleNumberHint.requestPhoneNumberHint} call.
 *
 * - `selected`    – the user picked a number; `phoneNumber` is populated.
 * - `cancelled`   – the user dismissed the picker without choosing a number.
 * - `unavailable` – the picker could not be shown because the device has no
 *                   eligible phone numbers, or the Phone Number Hint flow is
 *                   not supported on this device.
 */
export type PhoneNumberHintStatus = 'selected' | 'cancelled' | 'unavailable'

/**
 * The result of a phone number hint request.
 *
 * Only "hard" failures (no foreground Activity, Google Play Services missing,
 * or an unexpected platform error) reject the promise — ordinary outcomes such
 * as the user cancelling are surfaced here via {@link status} so callers never
 * have to treat a cancellation as an exception.
 */
export interface PhoneNumberHintResult {
  /** What happened when the picker was shown. */
  readonly status: PhoneNumberHintStatus
  /**
   * The number the user selected. Present only when {@link status} is
   * `'selected'`.
   *
   * In practice this is an E.164 string (e.g. `"+14155552671"`), but Google
   * does not formally guarantee the format — validate or normalize it (e.g.
   * with libphonenumber) before relying on it.
   */
  readonly phoneNumber?: string
}

/**
 * Native binding for Google's
 * [Phone Number Hint](https://developers.google.com/identity/phone-number-hint/android)
 * API — a lightweight, permission-free way to let the user pick one of the
 * phone numbers already on their device.
 *
 * Android-only. On unsupported platforms {@link isAvailable} is `false` and
 * {@link requestPhoneNumberHint} resolves with `status: 'unavailable'`.
 */
export interface NitroGoogleNumberHint extends HybridObject<{
  android: 'kotlin'
}> {
  /**
   * `true` when the Phone Number Hint flow can be shown on this device, i.e.
   * the app is running on Android with a compatible Google Play Services
   * installed. Reading this never throws.
   */
  readonly isAvailable: boolean

  /**
   * Shows the Google Phone Number Hint bottom sheet and resolves with the
   * user's choice.
   *
   * The promise rejects only on unrecoverable errors (no foreground Activity,
   * Google Play Services unavailable, or an internal platform error). User
   * cancellation and "no numbers available" resolve normally — inspect
   * {@link PhoneNumberHintResult.status}.
   */
  requestPhoneNumberHint(): Promise<PhoneNumberHintResult>
}
