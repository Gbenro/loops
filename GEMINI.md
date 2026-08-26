# Luna Loops - Hybrid Development Rules

This is a hybrid WSL/Windows React and Capacitor native Android application. All AI agents working on this project must adhere to these guidelines to ensure the web app and native Android app are always in sync.

---

## 1. Project Architecture

* **Web Code & MCP Server (WSL)**: Located inside the WSL workspace at `/home/ben/.openclaw/workspace/loops-app`.
* **Native Android Project (Windows)**: Located natively on the Windows C: drive at `C:\Users\Ben\loops-app-android`.
* **Capacitor Sync Directory**: Node modules and Capacitor plugins are copied directly into the Windows folder's local `node_modules` directory so Windows Gradle compiles natively without network/WSL latency.

---

## 2. Syncing Web Updates to the Android App

Whenever you modify any frontend code (HTML, React component, CSS, JS) inside the WSL workspace:
1. **You must sync the changes to the Windows folder immediately**.
2. Run this command from the WSL root folder:
   ```bash
   npm run cap:win-sync
   ```
3. This command builds the Vite production assets, updates the Capacitor platform files, and copies the synced files directly into the native Windows `C:\Users\Ben\loops-app-android` project.

---

## 3. SDK & Compilation Rules

* **SDK Version**: Keep `compileSdkVersion = 35` and `targetSdkVersion = 35` inside `variables.gradle` (in both WSL and Windows directories) to target Android 15 (stable). Do not upgrade to API 36/Android 16 preview unless requested, as it causes build failures on standard IDE setups.
* **No PWA Prompts on Native**: The `isInStandaloneMode` check in `App.jsx` returns `true` if `window.Capacitor` exists. Never prompt PWA installation or show "Add to Home Screen" banners when running inside the native mobile container.
* **Onboarding & Walkthrough Sync**: Onboarding completed state, tours, and tutorial seen states must be fetched/saved to the Supabase `profiles` table to prevent WebView storage clear resets.
