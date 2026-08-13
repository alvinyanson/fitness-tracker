jest.setTimeout(15000);

jest.mock('@react-native-firebase/app', () => ({
  initializeApp: jest.fn(),
}));

jest.mock('@react-native-firebase/crashlytics', () => {
  const crashlyticsInstance = {
    recordError: jest.fn(),
    log: jest.fn(),
    setUserId: jest.fn(),
    setAttributes: jest.fn(),
    setCrashlyticsCollectionEnabled: jest.fn(),
  };
  const getCrashlytics = jest.fn(() => crashlyticsInstance);
  return {
    __esModule: true,
    default: getCrashlytics,
    getCrashlytics,
  };
});
