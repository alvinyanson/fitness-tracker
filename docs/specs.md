# Fitness Tracker

Goal: This training exercise aims to teach how to bootstrap a new React Native application by reusing the architecture, components, and patterns already built for the weather app to internalize the scaffolding workflow rather than starting from scratch. After that, we will build out a fitness application using BLE device connectivity, workout tracking, and platform health-store integration[cite: 1].

Constraint: no custom backend. Everything either lives on-device, in the platform health store (Health Connect / HealthKit), or in a BaaS (SupaBase, Firebase) that you configure rather than build[cite: 1].

UI/UX Inspiration: https://dribbble.com/search/fitness-tracker[cite: 1]

Reusables: Read through the whole spec and write down everything you think you can reuse from the Weather Application. What you create in any project should be easily reusable in another project. This is a good exercise to identify what went wrong with how you abstracted a module that made it hard to reuse[cite: 1].

## Milestone 1: Core BLE + local tracking[cite: 1]

### 1. Device pairing screen[cite: 1]

Regarding devices, read the Addendum to see alternatives[cite: 1].

- BLE permission handling on entry (Android 12+ requires BLUETOOTH_SCAN/BLUETOOTH_CONNECT runtime permissions; iOS requires NSBluetoothAlwaysUsageDescription). This mirrors the weather app's location-permission flow, so the pattern should feel familiar[cite: 1].
- Scan for nearby devices advertising the Heart Rate Service (0x180D), list them with signal strength, allow tapping to connect[cite: 1].
- Connection states to handle explicitly: scanning / connecting / connected / disconnected / error. Same state-machine shape as the weather app's "detecting location / fetching weather / error" flow. The flow should remain stable despite disconnections or failed scanning[cite: 1].
- Persist the last-paired device ID locally so the app can attempt auto-reconnect on next launch (parallel to the weather app remembering the last searched/detected location)[cite: 1].
- Suggested library: react-native-ble-plx (mature, handles scanning/connect/notify well)[cite: 1].

### 2. Live workout screen[cite: 1]

- Once connected, subscribe to the Heart Rate Measurement characteristic notifications and display current BPM live: this is the direct equivalent of the weather app's "icon + temperature" glanceable readout[cite: 1].
- Elapsed session timer with Start / Pause / Resume / Stop controls[cite: 1].
- Simple live stats while active: current BPM, elapsed time, and a rolling avg BPM[cite: 1].
- Graceful handling of disconnects mid-session (BLE connections drop often — show a reconnecting indicator rather than killing the session)[cite: 1].

### 3. Session summary screen[cite: 1]

- On Stop, compute and show: total duration, avg HR, max HR, min HR[cite: 1].
- A detail screen reached after the main action (Stop), showing a richer view of one thing[cite: 1].
- Save the session to local storage immediately (no network dependency yet, that's deliberately deferred to Milestone 2)[cite: 1].

### 4. History screen[cite: 1]

- List of past sessions (date, duration, avg HR), newest first[cite: 1].
- Tap into a session to reopen its summary screen[cite: 1].
- This is the new "list + detail" pattern, but structurally similar to how the weather app might list recent/saved locations[cite: 1].

### 5. Local persistence[cite: 1]

- Simple local store (AsyncStorage to start, or SQLite/WatermelonDB to practice a slightly more structured local DB) holding: last paired device, and the session history array[cite: 1].
- No syncing, no cloud, no offline indicator yet, all of that is intentionally Milestone 2, so Milestone 1 stays focused purely on "can I talk to a BLE device and record something real from it."[cite: 1]

---

## Milestone 2: Platform integration, sync, polish[cite: 1]

- Units toggle: metric/imperial (km vs mi, kg vs lb), same pattern as the weather app's F°/C°. See if you can reuse a component and store here, and what is preventing you from reusing it[cite: 1].
- i18n: same translation module approach as weather app. This should not take you much time as it was already created in the Weather Application[cite: 1].
- Health platform write-back (this replaces "cache + reconnect" from the weather app with something more valuable here): write completed sessions to Health Connect on Android and HealthKit on iOS. This teaches you that "offline-first" for this domain means writing to the OS-level health store, which itself syncs, no custom sync logic needed. Note that Google Fit is the wrong tutorial to follow, it is deprecated[cite: 1].
- Offline/online indicator + local cache: still relevant for anything that needs a network call (e.g. login, cloud settings sync): same NetInfo-based pattern as in the Weather application[cite: 1].
- Apple/Google login + cloud settings sync: Firebase Auth (Sign in with Apple/Google) + Firestore to store user preferences (units, language): again, BaaS not custom backend. Don’t code the backend yourself[cite: 1].
- Responsive tablet/web: Web Bluetooth exists but is inconsistent/limited (no iOS Safari support at all), this is a natural discussion point about graceful degradation (e.g. web shows manual entry/history instead of live BLE pairing). How can we manage this gracefully?[cite: 1]

---

## Optional stretch (Milestone 3-ish)[cite: 1]

### Strava's API Integration[cite: 1]

- Import past activities from Strava's API (OAuth, well-documented, no backend needed) to try a second "reuse an open interface" pattern beyond device pairing[cite: 1].
- Export tracked activities to Strava's profile. Whenever the activity is done, we upload it with all the tracked information to Strava[cite: 1].

### Route tracking + map redraw[cite: 1]

- Sample GPS coordinates at intervals during the workout, stored as a lat/lng array per session[cite: 1].
- Draw the route as a polyline on a map afterward using react-native-maps (Google Maps on Android, Apple Maps on iOS) or @rnmapbox/maps (consistent look across both platforms, plus nicer styling control)[cite: 1].
- Needs foreground location permission at minimum[cite: 1].
- Background location tracking (so the route still records if the app is backgrounded mid-run) is a meaningfully harder problem and is optional/advanced rather than assumed in this training but it's an interesting problem encountered in many applications[cite: 1].
- Battery optimization, understanding of what is draining the battery in this setup and how to optimize the battery usage[cite: 1].

---

### Step counting[cite: 1]

- Phones have a dedicated hardware pedometer. iOS exposes it via CMPedometer, Android via the TYPE_STEP_COUNTER/TYPE_STEP_DETECTOR sensors, more consistently with the Milestone 2 architecture, read aggregated step data straight from Health Connect/HealthKit, same store the app is already writing sessions to[cite: 1].
- Do not try to derive steps from raw accelerometer data, this is a fun exercise but is a LOT more complex[cite: 1].

### Calorie estimation[cite: 1]

- Combine a MET-based formula (calories ≈ MET value for the activity type × weight in kg × duration in hours) with an HR-adjusted correction when heart rate data is available, since HR-based formulas (e.g. Keytel et al.) are noticeably more accurate than METs alone[cite: 1].
- The calorie formula needs the user's weight as an input, so those two features are linked, cf. below[cite: 1].

### Weight tracking[cite: 1]

- Add a weight field to the user profile/settings, with a simple history/chart over time[cite: 1].
- Ask for the user's weight when first accessing the application and always take the latest weight value in the calorie calculations[cite: 1].
- Natural fit for the Health Connect/HealthKit integration already in Milestone 2: both platforms have a native body-weight record type, so this can sync the same way workout sessions do rather than needing separate storage[cite: 1].

### Altitude profile[cite: 1]

- iOS: CMAltimeter gives relative altitude change via the barometer. Android: barometer sensor availability is inconsistent across devices, so GPS-reported altitude (already coming along with the route coordinates) is the more reliable cross-platform fallback, even though it's noisier[cite: 1].
- Profile Rendering in the workout session: a simple line chart of altitude over time/distance (recharts or similar) alongside the route map[cite: 1].

## Addendum[cite: 1]

No dedicated open HR band available[cite: 1]

Many Garmin watches (Forerunner 245/945+, Fenix 6/7, Venu series, and newer) have a "Broadcast Heart Rate" setting (Settings → Sensors & Accessories → Wrist Heart Rate → Broadcast Heart Rate) that makes the watch advertise as a standard BLE Heart Rate Service device meaning your app's existing 0x180D pairing flow should work against it with zero changes[cite: 1].

1. Garmin watch, broadcasting enabled: connects as a standard BLE HR device, no app changes needed (see above)[cite: 1].
2. Garmin Connect API: a fallback for watches without BLE broadcast: pull historical HR/activity data via Garmin's developer API instead of live BLE. Different integration path (OAuth + REST rather than BLE), useful as a second "reuse an open interface" exercise, but it's after-the-fact data, not live streaming[cite: 1].
3. Any other BLE HR chest strap/armband (Polar, Wahoo, CooSpo, etc.) cheap (~€20-40) and all speak the same 0x180D standard, but we are not requesting you to buy anything if you don’t want to[cite: 1].
4. Samsung Watch: third-party Wear OS apps (e.g. HR2VP, Heart for Bluetooth) read the raw sensor and rebroadcast it as a standard BLE HR device but users report it can be flaky (requires the watch app to stay active, screen-off sensor throttling, etc.)[cite: 1]
5. Apple Watch: same story, third-party bridge apps (HeartBLE, Watch Link, HRM Heart Rate Monitor) run on the watch/phone and rebroadcast as a standard BLE HR device, same 0x180D profile your app already targets[cite: 1].
6. No HR at all, workout still recorded — treat HR as optional per session; calorie estimation falls back to the pure MET formula (activity type × weight × duration) without the HR-adjusted correction. Worth designing for this from the start anyway, since not every trainee will have a device[cite: 1].