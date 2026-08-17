const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
} = require('@expo/config-plugins');

const pkg = {
  name: 'withHealthConnectManifest',
  version: '1.0.0',
};

const { getMainActivityOrThrow, getMainApplicationOrThrow } =
  AndroidConfig.Manifest;

const RATIONALE_ACTION = 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE';
const VIEW_PERMISSION_USAGE_ALIAS = 'ViewPermissionUsageActivity';

const hasIntentFilter = (androidName, intentFilters) =>
  (intentFilters || []).some((intentFilter) =>
    (intentFilter.action || []).some(
      (action) => action.$?.['android:name'] === androidName,
    ),
  );

const hasActivityAlias = (androidName, activityAliases) =>
  (activityAliases || []).some(
    (activityAlias) => activityAlias.$?.['android:name'] === androidName,
  );

const hasActivity = (androidName, activities) =>
  (activities || []).some(
    (activity) => activity.$?.['android:name'] === androidName,
  );

const withHealthConnectManifest = (config) =>
  withAndroidManifest(config, async (config) => {
    const mainApplication = getMainApplicationOrThrow(config.modResults);
    const mainActivity = getMainActivityOrThrow(config.modResults);

    // 1. Add rationale intent-filter to MainActivity (for Android <= 13)
    if (!mainActivity['intent-filter']) {
      mainActivity['intent-filter'] = [];
    }

    if (!hasIntentFilter(RATIONALE_ACTION, mainActivity['intent-filter'])) {
      mainActivity['intent-filter'].push({
        action: [{ $: { 'android:name': RATIONALE_ACTION } }],
      });
    }

    // 2. Add .PermissionsRationaleActivity activity + matching intent-filter
    if (!mainApplication.activity) {
      mainApplication.activity = [];
    }

    if (
      !hasActivity('.PermissionsRationaleActivity', mainApplication.activity)
    ) {
      mainApplication.activity.push({
        $: {
          'android:name': '.PermissionsRationaleActivity',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': RATIONALE_ACTION } }],
          },
        ],
      });
    }

    // 3. Add ViewPermissionUsageActivity activity-alias (for Android 14+)
    if (!mainApplication['activity-alias']) {
      mainApplication['activity-alias'] = [];
    }

    if (
      !hasActivityAlias(
        VIEW_PERMISSION_USAGE_ALIAS,
        mainApplication['activity-alias'],
      )
    ) {
      mainApplication['activity-alias'].push({
        $: {
          'android:name': VIEW_PERMISSION_USAGE_ALIAS,
          'android:exported': 'true',
          'android:targetActivity': mainActivity.$['android:name'],
          'android:permission':
            'android.permission.START_VIEW_PERMISSION_USAGE',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE',
                },
              },
            ],
            category: [
              {
                $: {
                  'android:name': 'android.intent.category.HEALTH_PERMISSIONS',
                },
              },
            ],
          },
        ],
      });
    }

    return config;
  });

module.exports = createRunOncePlugin(
  withHealthConnectManifest,
  pkg.name,
  pkg.version,
);
