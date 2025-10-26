# Capacitor Remote URL Health Check

This report documents the repository-side validation for loading the HematWoi mobile shell from the remote domain `https://www.hemat-woi.me`.

## Configuration Verification

### A. Capacitor Config
- `capacitor.config.ts` already points the Capacitor runtime to `https://www.hemat-woi.me` with `cleartext` enabled so the web bundle is always fetched remotely.

### B. Android Toolchain
- `android/variables.gradle` targets SDK 34/min SDK 22. Confirm Java 17, Android SDK path (`local.properties`), and build-tools 34.x locally before assembling a release build.

### C. Android Manifest & Permissions
- The manifest registers the FileProvider authority, camera/gallery access, and `POST_NOTIFICATIONS` to satisfy Capacitor Camera, Filesystem, and Local Notifications on Android 13+.
- Extra file system paths (`external`, `cache`, `files`) are exposed through `file_paths.xml` for photo capture and sharing.

### D. Native Plugins
- `package.json` already bundles the Capacitor bridge core plus camera, filesystem, preferences, local notifications, push notifications, splash screen, status bar, and Google Auth, so running `npx cap sync android` after dependency changes keeps Android aligned.

### E. Vercel Hosting & SPA Routing
- `vercel.json` sets `no-store` caching for the shell, immutable caching for build assets, and a filesystem-first SPA fallback to `/`, ensuring fresh deployments propagate to the native shell immediately.

### F. Supabase Domains
- Project documentation now references `https://www.hemat-woi.me` for Supabase Site URL, redirect URIs, and authorized origins, matching the remote shell domain.

### G. Notification Channel Mapping
- Native code provisions the `hematwoi-reminders` notification channel before scheduling reminders, aligning Android expectations with documentation.

## Health Tests (Device Required)
The following end-to-end checks require an instrumented Android/iOS device or emulator. They were **not executed inside this container**; run them on the prepared APK and record results below.

| ID  | Scenario                                   | Status  | Notes |
| --- | ------------------------------------------- | ------- | ----- |
| G1  | Remote bridge loads UI & Capacitor context | FAILED  | Not run in CI container; verify on device and capture `adb logcat` if the web view fails to load. |
| G2  | Camera capture & Supabase upload           | FAILED  | Not run in CI container; confirm permissions prompts, upload path (`receipts/`), and Supabase response. |
| G3  | Local notifications (immediate & H-7)      | FAILED  | Not run in CI container; ensure `POST_NOTIFICATIONS` granted and channel `hematwoi-reminders` exists. |
| G4  | Preferences persistence                    | FAILED  | Not run in CI container; toggle theme/accent, kill app, relaunch to validate Capacitor Preferences sync. |
| G5  | Supabase auth session retention            | FAILED  | Not run in CI container; login, relaunch, and confirm `user.id` persists. |
| G6  | Deeplink handling                          | FAILED  | Not run in CI container; execute `adb shell am start -W -a android.intent.action.VIEW -d "hematwoi://auth/callback?ok=1"`. |
| G7  | Offline experience                         | FAILED  | Not run in CI container; test airplane mode to ensure cached shell + online recovery. |

## Diagnostic Commands & Quick Fixes
- Inspect runtime logs: `adb logcat | findstr -i "hematwoi capacitor error exception"`
- Review permission grants (Android 13+): `adb shell cmd appops get com.hematwoi.app`
- Clear data / reinstall: `adb shell pm clear com.hematwoi.app`, `adb uninstall com.hematwoi.app`
- Confirm Gradle Java version: `(cd android && ./gradlew -version)`
- Notification channel bootstrap happens in `ensureNotificationChannel()`; call `LocalNotifications.createChannel` early if custom scheduling is added.

Run the device tests above and update the status table once validation is complete.
