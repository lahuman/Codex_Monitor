import configuration from "../../../desktop/src-tauri/tauri.conf.json";

export const productName = configuration.productName;
export const productVersion = configuration.version;
export const minimumMacOS = configuration.bundle.macOS.minimumSystemVersion;
