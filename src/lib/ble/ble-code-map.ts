import { ParameterCodes } from "./parameter-codes";

/** Maps app parameter identifiers to BLE protocol byte codes (matches mobile app). */
const parameters: Record<string, number> = {
  [ParameterCodes.serialNumber]: 0x10,
  APN: 0x20,
  APN_USERNAME: 0x21,
  APN_PASSWORD: 0x22,
  SIM_PIN: 0x23,
  CONNECTION_TIMEOUT: 0x28,
  CONNECTION_STATE: 0x29,
  IMEI: 0x30,
  SIGNAL_RSSI: 0x34,
  WAN_TYPE: 0x40,
  STA_SSID: 0x41,
  STA_PASSWORD: 0x42,
  IP_MODE: 0x43,
  IP_ADDRESS: 0x44,
  SUBNET_MASK: 0x45,
  GATEWAY: 0x46,
  DNS_SERVER: 0x47,
  WAN_CONNECTION_STATUS: 0x48,
  LOCAL_AP_SSID: 0x4c,
  LOCAL_AP_PASSWORD: 0x4d,
  LOCAL_AP_DHCP: 0x50,
  LOCAL_AP_CHANNEL: 0x51,
  SERVER_ENABLE: 0x70,
  SERVER_PROTOCOL: 0x71,
  SERVER_ADDRESS: 0x72,
  SERVER_PORT: 0x73,
  SERVER_PASSWORD_KEY: 0x76,
  KEEP_ALIVE_INTERVAL: 0x77,
  SERVER_CONNECTION_TIMEOUT: 0x78,
};

export function parameterByte(code: string): number | undefined {
  return parameters[code];
}
