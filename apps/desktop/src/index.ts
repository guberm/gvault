export interface DesktopTarget {
  platform: "windows" | "linux";
  runtime: "tauri-or-electron";
  webBundle: "../../web/dist";
  secureStorage: "os-keychain";
  biometricUnlock: "windows-hello-or-libsecret";
}

export const desktopTargets: DesktopTarget[] = [
  { platform: "windows", runtime: "tauri-or-electron", webBundle: "../../web/dist", secureStorage: "os-keychain", biometricUnlock: "windows-hello-or-libsecret" },
  { platform: "linux", runtime: "tauri-or-electron", webBundle: "../../web/dist", secureStorage: "os-keychain", biometricUnlock: "windows-hello-or-libsecret" }
];
