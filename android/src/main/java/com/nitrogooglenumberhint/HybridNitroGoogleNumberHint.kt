package com.nitrogooglenumberhint

import android.app.Activity
import android.app.PendingIntent
import android.content.Context
import android.content.IntentSender
import android.os.Handler
import android.os.Looper
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResult
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.LifecycleOwner
import com.google.android.gms.auth.api.identity.GetPhoneNumberHintIntentRequest
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import com.margelo.nitro.nitrogooglenumberhint.HybridNitroGoogleNumberHintSpec
import com.margelo.nitro.nitrogooglenumberhint.PhoneNumberHintResult
import com.margelo.nitro.nitrogooglenumberhint.PhoneNumberHintStatus
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

/**
 * Android implementation of the Phone Number Hint HybridObject.
 *
 * Wraps Google Play Services'
 * [Phone Number Hint](https://developers.google.com/identity/phone-number-hint/android)
 * API: it asks the framework for a [android.app.PendingIntent], shows it as a
 * bottom sheet via the AndroidX Activity Result APIs, and parses the chosen
 * number out of the returned [android.content.Intent].
 *
 * All UI work is marshalled onto the main thread, so the call itself is safe to
 * make from any thread.
 */
class HybridNitroGoogleNumberHint : HybridNitroGoogleNumberHintSpec() {

  private val mainHandler = Handler(Looper.getMainLooper())

  override val isAvailable: Boolean
    get() {
      val context = NitroModules.applicationContext ?: return false
      return GoogleApiAvailability.getInstance()
        .isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS
    }

  override fun requestPhoneNumberHint(): Promise<PhoneNumberHintResult> {
    val promise = Promise<PhoneNumberHintResult>()
    // The Activity Result APIs must only be touched from the main thread.
    mainHandler.post {
      try {
        startHintFlow(promise)
      } catch (throwable: Throwable) {
        promise.reject(throwable)
      }
    }
    return promise
  }

  private fun startHintFlow(promise: Promise<PhoneNumberHintResult>) {
    val activity = NitroModules.applicationContext?.currentActivity
      ?: throw PhoneNumberHintException(
        "No foreground Activity is available to present the phone number hint."
      )

    if (activity !is ComponentActivity) {
      throw PhoneNumberHintException(
        "The current Activity (${activity.javaClass.name}) is not a ComponentActivity, " +
          "so the phone number hint cannot be presented."
      )
    }

    val request = GetPhoneNumberHintIntentRequest.builder().build()
    Identity.getSignInClient(activity)
      .getPhoneNumberHintIntent(request)
      .addOnSuccessListener { pendingIntent -> launchPicker(activity, pendingIntent, promise) }
      .addOnFailureListener {
        // The framework reports "no eligible phone numbers" (and similar
        // non-fatal conditions) here rather than as a cancelled result.
        promise.resolve(unavailable())
      }
  }

  private fun launchPicker(
    activity: ComponentActivity,
    pendingIntent: PendingIntent,
    promise: Promise<PhoneNumberHintResult>,
  ) {
    // The promise must be settled exactly once, whichever happens first: the
    // picker result, a launch failure, or the host Activity being destroyed
    // while the sheet is on screen. `settled` guards against double-settling.
    val settled = AtomicBoolean(false)
    val lifecycle = activity.lifecycle

    // Register a one-shot launcher under a unique key. Because we register
    // without a LifecycleOwner we own its lifetime and must unregister it again,
    // which we do on every terminal path. The launcher is only created here —
    // once we actually have a PendingIntent — so a failure to obtain the intent
    // never leaks a registration.
    val key = "$RESULT_KEY_PREFIX${keyCounter.incrementAndGet()}"
    var launcher: ActivityResultLauncher<IntentSenderRequest>? = null

    // If the Activity is destroyed/recreated while the picker is visible
    // ("Don't keep activities", process death, rotation), the result callback
    // is torn down with it and would otherwise leave the JS promise pending
    // forever. Settle it as a cancellation in that case.
    val observer = object : LifecycleEventObserver {
      override fun onStateChanged(source: LifecycleOwner, event: Lifecycle.Event) {
        if (event != Lifecycle.Event.ON_DESTROY) return
        lifecycle.removeObserver(this)
        if (settled.compareAndSet(false, true)) {
          launcher?.unregister()
          promise.resolve(PhoneNumberHintResult(PhoneNumberHintStatus.CANCELLED, null))
        }
      }
    }

    launcher = activity.activityResultRegistry.register(
      key,
      ActivityResultContracts.StartIntentSenderForResult(),
    ) { result: ActivityResult ->
      launcher?.unregister()
      lifecycle.removeObserver(observer)
      if (settled.compareAndSet(false, true)) {
        deliverResult(activity, result, promise)
      }
    }

    lifecycle.addObserver(observer)

    try {
      val intentSenderRequest =
        IntentSenderRequest.Builder(pendingIntent.intentSender).build()
      launcher.launch(intentSenderRequest)
    } catch (e: IntentSender.SendIntentException) {
      rejectOnce(
        launcher, observer, lifecycle, settled, promise,
        PhoneNumberHintException("Failed to launch the phone number hint picker.", e),
      )
    } catch (throwable: Throwable) {
      rejectOnce(launcher, observer, lifecycle, settled, promise, throwable)
    }
  }

  private fun rejectOnce(
    launcher: ActivityResultLauncher<IntentSenderRequest>?,
    observer: LifecycleEventObserver,
    lifecycle: Lifecycle,
    settled: AtomicBoolean,
    promise: Promise<PhoneNumberHintResult>,
    error: Throwable,
  ) {
    launcher?.unregister()
    lifecycle.removeObserver(observer)
    if (settled.compareAndSet(false, true)) {
      promise.reject(error)
    }
  }

  private fun deliverResult(
    context: Context,
    result: ActivityResult,
    promise: Promise<PhoneNumberHintResult>,
  ) {
    val data = result.data
    if (result.resultCode != Activity.RESULT_OK || data == null) {
      promise.resolve(PhoneNumberHintResult(PhoneNumberHintStatus.CANCELLED, null))
      return
    }
    try {
      val phoneNumber = Identity.getSignInClient(context).getPhoneNumberFromIntent(data)
      promise.resolve(PhoneNumberHintResult(PhoneNumberHintStatus.SELECTED, phoneNumber))
    } catch (throwable: Throwable) {
      // The picker returned OK but no number could be extracted.
      promise.resolve(unavailable())
    }
  }

  private fun unavailable() = PhoneNumberHintResult(PhoneNumberHintStatus.UNAVAILABLE, null)

  private companion object {
    private const val RESULT_KEY_PREFIX = "NitroGoogleNumberHint#"
    private val keyCounter = AtomicLong(0)
  }
}

/** Raised when the phone number hint flow cannot be started or completed. */
class PhoneNumberHintException(
  message: String,
  cause: Throwable? = null,
) : RuntimeException(message, cause)
