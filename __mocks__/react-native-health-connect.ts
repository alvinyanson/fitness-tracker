import type { Permission } from 'react-native-health-connect';

declare module 'react-native-health-connect' {
  export function __setSdkStatus(status: number | Error): void;
  export function __setInitializeResult(result: boolean | Error): void;
  export function __setGrantedPermissions(
    permissions: Permission[] | Error,
  ): void;
  export function __resetMocks(): void;
}

export const SdkAvailabilityStatus = {
  SDK_UNAVAILABLE: 1,
  SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2,
  SDK_AVAILABLE: 3,
} as const;

let mockedSdkStatus: number | Error = SdkAvailabilityStatus.SDK_AVAILABLE;
let mockedInitializeResult: boolean | Error = true;
let mockedGrantedPermissions: Permission[] | Error = [];

export function __setSdkStatus(status: number | Error): void {
  mockedSdkStatus = status;
}

export function __setInitializeResult(result: boolean | Error): void {
  mockedInitializeResult = result;
}

export function __setGrantedPermissions(
  permissions: Permission[] | Error,
): void {
  mockedGrantedPermissions = permissions;
}

export function __resetMocks(): void {
  mockedSdkStatus = SdkAvailabilityStatus.SDK_AVAILABLE;
  mockedInitializeResult = true;
  mockedGrantedPermissions = [];
  getSdkStatus.mockClear();
  initialize.mockClear();
  requestPermission.mockClear();
}

export const getSdkStatus = jest.fn(
  async (_providerPackageName?: string): Promise<number> => {
    if (mockedSdkStatus instanceof Error) {
      throw mockedSdkStatus;
    }
    return mockedSdkStatus;
  },
);

export const initialize = jest.fn(
  async (_providerPackageName?: string): Promise<boolean> => {
    if (mockedInitializeResult instanceof Error) {
      throw mockedInitializeResult;
    }
    return mockedInitializeResult;
  },
);

export const requestPermission = jest.fn(
  async (_permissions: Permission[]): Promise<Permission[]> => {
    if (mockedGrantedPermissions instanceof Error) {
      throw mockedGrantedPermissions;
    }
    return mockedGrantedPermissions;
  },
);

export const openHealthConnectSettings = jest.fn();
export const openHealthConnectDataManagement = jest.fn();
export const getGrantedPermissions = jest.fn(async () => []);
export const revokeAllPermissions = jest.fn(async () => {});
export const readRecords = jest.fn(async () => ({ records: [] }));
export const readRecord = jest.fn(async () => ({}));
export const insertRecords = jest.fn(async () => []);
export const aggregateRecord = jest.fn(async () => ({}));
