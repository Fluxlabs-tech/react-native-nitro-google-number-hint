# react-native-nitro-google-number-hint

> Pick a phone number from the device using Google's **Phone Number Hint** API — a fast, permission-free [Nitro](https://nitro.margelo.com) module for React Native.

[![Version](https://img.shields.io/npm/v/react-native-nitro-google-number-hint.svg)](https://www.npmjs.com/package/react-native-nitro-google-number-hint)
[![Downloads](https://img.shields.io/npm/dm/react-native-nitro-google-number-hint.svg)](https://www.npmjs.com/package/react-native-nitro-google-number-hint)
[![License](https://img.shields.io/npm/l/react-native-nitro-google-number-hint.svg)](./LICENSE)

The [Phone Number Hint API](https://developers.google.com/identity/phone-number-hint/android) shows a lightweight bottom sheet that lets the user pick one of the phone numbers already available on their device (from SIM cards and their Google account). It's the recommended way to pre-fill a phone number field — for example during sign-up or OTP flows — **without requesting any permissions**.

<p align="center">
  <em>One tap → the user picks a number → you get it back (typically E.164).</em>
</p>

## Features

- 📱 **No permissions required** — no `READ_PHONE_STATE`, no manifest changes.
- ⚡ **Built on [Nitro Modules](https://nitro.margelo.com)** — synchronous, JSI-based, zero bridge overhead.
- 🧩 **Tiny, ergonomic API** — one function call returns a typed result.
- 🛟 **Cross-platform safe** — calling it on iOS/web is a no-op that resolves to `unavailable` instead of throwing.
- 🦺 **Fully typed** — first-class TypeScript types generated from the native spec.

## Platform support

| Platform | Supported | Notes                                                        |
| -------- | :-------: | ------------------------------------------------------------ |
| Android  |    ✅     | Requires Google Play Services.                               |
| iOS      |    ❌     | No system equivalent — calls resolve to `{ status: 'unavailable' }`. |

## Requirements

- React Native **0.76+** (new architecture)
- `react-native-nitro-modules` (peer dependency)
- Android **minSdk 23+** and a device/emulator with Google Play Services

## Installation

```bash
npm install react-native-nitro-google-number-hint react-native-nitro-modules
# or
yarn add react-native-nitro-google-number-hint react-native-nitro-modules
```

Then rebuild the Android app so autolinking picks up the native module:

```bash
npx react-native run-android
```

There is **nothing else to configure** — no permissions, no `AndroidManifest.xml` changes, and the required `play-services-auth` dependency is bundled with the module.

> If the module isn't picked up after upgrading, do a clean rebuild:
> `cd android && ./gradlew clean && cd .. && npx react-native run-android`.

### Expo

Works with Expo via a [development build](https://docs.expo.dev/develop/development-builds/introduction/) — **no config plugin is required** (the module needs no permissions or manifest changes, and autolinking handles it during `npx expo prebuild`). It does **not** run in Expo Go, which can't load custom native code.

```bash
npx expo install react-native-nitro-google-number-hint react-native-nitro-modules
npx expo prebuild
npx expo run:android
```

> [!NOTE]
> Phone Number Hint relies on Google Play Services. It will not work on devices/emulators without it (e.g. plain AOSP images). Use a Google Play system image when testing on an emulator.

## Usage

```ts
import {
  requestPhoneNumberHint,
  isPhoneNumberHintAvailable,
} from 'react-native-nitro-google-number-hint'

async function pickPhoneNumber() {
  if (!isPhoneNumberHintAvailable()) {
    return // iOS, or no Google Play Services
  }

  const result = await requestPhoneNumberHint()

  switch (result.status) {
    case 'selected':
      console.log('User picked', result.phoneNumber) // e.g. "+14155552671"
      break
    case 'cancelled':
      console.log('User dismissed the picker')
      break
    case 'unavailable':
      console.log('No eligible phone numbers on this device')
      break
  }
}
```

### Just want the number?

Use the `getPhoneNumberHint()` convenience wrapper, which returns the selected number or `null`:

```ts
import { getPhoneNumberHint } from 'react-native-nitro-google-number-hint'

const phone = await getPhoneNumberHint()
if (phone) {
  setPhoneNumber(phone)
}
```

## API

### `requestPhoneNumberHint(): Promise<PhoneNumberHintResult>`

Shows the Phone Number Hint bottom sheet and resolves with the outcome.

The promise **rejects only on unrecoverable errors** — there is no foreground `Activity` to present the sheet, or an unexpected platform error. Ordinary outcomes such as the user cancelling, or there being no eligible numbers, resolve normally so you never have to wrap a cancellation in a `try/catch`.

```ts
type PhoneNumberHintStatus = 'selected' | 'cancelled' | 'unavailable'

interface PhoneNumberHintResult {
  status: PhoneNumberHintStatus
  /** Selected number, set only when status === 'selected'. Typically E.164 (e.g. "+14155552671"), but Google does not guarantee the format — validate before use. */
  phoneNumber?: string
}
```

| `status`      | Meaning                                                                 |
| ------------- | ----------------------------------------------------------------------- |
| `selected`    | The user picked a number; `phoneNumber` is populated.                   |
| `cancelled`   | The user dismissed the sheet without choosing.                          |
| `unavailable` | No eligible numbers, or the picker can't be shown (e.g. non-Android).   |

### `getPhoneNumberHint(): Promise<string | null>`

Convenience wrapper that returns just the selected phone number, or `null` when the user cancelled / no numbers were available / the platform is unsupported.

### `getParsedPhoneNumberHint(): Promise<PhoneNumberHintParts | null>`

The picker always returns the number in **E.164** form, which begins with the country calling code (`+44` for the UK, `+1` for the US/Canada, `+91` for India, …). This helper splits that for you, or returns `null` when no number was selected:

```ts
import { getParsedPhoneNumberHint } from 'react-native-nitro-google-number-hint'

const parts = await getParsedPhoneNumberHint()
// {
//   e164: '+447911123456',
//   countryCallingCode: '44',
//   nationalNumber: '7911123456',
// }
```

```ts
interface PhoneNumberHintParts {
  e164: string //               full E.164 value, e.g. "+447911123456"
  countryCallingCode: string // calling code without "+", e.g. "44"
  nationalNumber: string //     number after the country code, e.g. "7911123456"
}
```

`parsePhoneNumber(e164: string): PhoneNumberHintParts` is also exported as a pure, synchronous function if you already have a number string.

The split uses the ITU country-calling-code table and needs **no extra dependency**. `nationalNumber` is the raw national number — it is *not* locale-grouped. For pretty display formatting (e.g. `07911 123456`), pass `e164` to [`libphonenumber-js`](https://github.com/catamphetamine/libphonenumber-js):

```ts
import { parsePhoneNumber } from 'libphonenumber-js'
parsePhoneNumber('+447911123456').formatNational() // "07911 123456"
```

### `isPhoneNumberHintAvailable(): boolean`

Returns `true` when the device has a compatible Google Play Services (Android only); `false` on other platforms. Never throws — ideal for gating UI. Note this is a Play Services *presence* check: it does not guarantee the user has any eligible numbers or that a foreground `Activity` exists, so still handle the `unavailable` / `cancelled` results (and possible rejections) from `requestPhoneNumberHint()`.

## How it works

Under the hood the module:

1. Reads the current React Native `Activity` from Nitro's application context.
2. Asks Google Play Services for a `PendingIntent` via
   `Identity.getSignInClient(activity).getPhoneNumberHintIntent(...)`.
3. Launches it with the AndroidX **Activity Result APIs**
   (`ActivityResultContracts.StartIntentSenderForResult`), registering a
   one-shot launcher and unregistering it as soon as the result arrives.
4. Parses the chosen number with
   `Identity.getSignInClient(activity).getPhoneNumberFromIntent(data)` and
   resolves the JS promise.

All native UI work runs on the main thread, so you can call the API from anywhere in JS.

## Troubleshooting

- **`status` is always `unavailable`** — the device has no SIM and no phone numbers attached to its Google account, or Google Play Services is missing/outdated. Test on a real device or a Google Play emulator image with a phone number configured.
- **Promise rejects with "No foreground Activity"** — the app was backgrounded, or the call happened before the host `Activity` was created. Call it in response to a user interaction.
- **Nothing happens on iOS** — that's expected. iOS has no equivalent API; `requestPhoneNumberHint()` resolves to `{ status: 'unavailable' }`.

## Contributing

The repo is a standard Nitro module workspace with an `example/` app.

```bash
npm install            # install root + example deps
npm run codegen        # run Nitrogen, build the JS, apply the OnLoad fix
npm run typecheck      # type-check the library
```

Pull requests are welcome. For major changes, please open an issue first.

## License

[MIT](./LICENSE)

---

Built with [Nitro Modules](https://nitro.margelo.com) · bootstrapped with [create-nitro-module](https://github.com/patrickkabwe/create-nitro-module).
