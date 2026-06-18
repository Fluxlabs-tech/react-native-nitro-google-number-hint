import { NitroModules } from 'react-native-nitro-modules'
import { Platform } from 'react-native'
import type {
  NitroGoogleNumberHint,
  PhoneNumberHintResult,
} from './specs/NitroGoogleNumberHint.nitro'

import { parsePhoneNumber, type PhoneNumberHintParts } from './parse'

export type {
  NitroGoogleNumberHint,
  PhoneNumberHintResult,
  PhoneNumberHintStatus,
} from './specs/NitroGoogleNumberHint.nitro'
export { parsePhoneNumber } from './parse'
export type { PhoneNumberHintParts } from './parse'

/**
 * The Phone Number Hint flow is Android-only. We create the underlying
 * HybridObject lazily and only on Android so that importing this module never
 * throws on iOS, web, or in a test environment where the native side is absent.
 */
let cachedHybrid: NitroGoogleNumberHint | null = null

function getHybrid(): NitroGoogleNumberHint {
  cachedHybrid ??= NitroModules.createHybridObject<NitroGoogleNumberHint>(
    'NitroGoogleNumberHint'
  )
  return cachedHybrid
}

/**
 * Whether the Google Phone Number Hint picker can be shown on this device.
 *
 * Returns `false` on non-Android platforms and when Google Play Services is
 * unavailable. Never throws.
 */
export function isPhoneNumberHintAvailable(): boolean {
  if (Platform.OS !== 'android') return false
  try {
    return getHybrid().isAvailable
  } catch {
    return false
  }
}

/**
 * Shows the Google Phone Number Hint bottom sheet and resolves with the user's
 * choice.
 *
 * On non-Android platforms this resolves immediately with
 * `{ status: 'unavailable' }`. The promise rejects only on unrecoverable
 * errors — see {@link NitroGoogleNumberHint.requestPhoneNumberHint}.
 *
 * @example
 * ```ts
 * const result = await requestPhoneNumberHint()
 * if (result.status === 'selected') {
 *   console.log('User picked', result.phoneNumber)
 * }
 * ```
 */
export function requestPhoneNumberHint(): Promise<PhoneNumberHintResult> {
  if (Platform.OS !== 'android') {
    return Promise.resolve({ status: 'unavailable' })
  }
  // Creating the HybridObject throws synchronously if the native module isn't
  // registered (autolinking/codegen not run, app not rebuilt, Expo Go). Convert
  // that into a rejection so callers always get a Promise, never a throw.
  try {
    return getHybrid().requestPhoneNumberHint()
  } catch (error) {
    return Promise.reject(error)
  }
}

/**
 * Convenience wrapper that returns just the selected phone number, or `null`
 * when the user cancelled, no numbers were available, or the platform is
 * unsupported. Rejects only on unrecoverable errors.
 *
 * @example
 * ```ts
 * const phone = await getPhoneNumberHint()
 * if (phone) setPhoneNumber(phone)
 * ```
 */
export async function getPhoneNumberHint(): Promise<string | null> {
  const result = await requestPhoneNumberHint()
  return result.status === 'selected' ? (result.phoneNumber ?? null) : null
}

/**
 * Like {@link getPhoneNumberHint}, but resolves with the number split into its
 * country calling code and national number (see {@link PhoneNumberHintParts}),
 * or `null` when no number was selected. Rejects only on unrecoverable errors.
 *
 * @example
 * ```ts
 * const parts = await getParsedPhoneNumberHint()
 * if (parts) {
 *   console.log(parts.countryCallingCode) // "44"
 *   console.log(parts.nationalNumber)     // "7911123456"
 *   console.log(parts.e164)               // "+447911123456"
 * }
 * ```
 */
export async function getParsedPhoneNumberHint(): Promise<PhoneNumberHintParts | null> {
  const phoneNumber = await getPhoneNumberHint()
  return phoneNumber == null ? null : parsePhoneNumber(phoneNumber)
}
