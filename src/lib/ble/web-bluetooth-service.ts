import type { BleProfile } from "@/types/entities";
import { parameterByte } from "./ble-code-map";
import {
  BleError,
  BleErrors,
  isLeScanSupported,
  isWebBluetoothSupported,
  matchesAdvertisedName,
  normalizeUuid,
} from "./ble-errors";
import {
  BleProtocolOp,
  buildBlePacket,
  encodeBleString,
  parseBlePacket,
  type ParsedBlePacket,
} from "./ble-protocol";
import { ParameterCodes } from "./parameter-codes";

export interface DiscoveredBleDevice {
  id: string;
  name: string;
  rssi: number;
  device: BluetoothDevice;
}

type PendingRequest = {
  request: Uint8Array;
  resolve: (packet: ParsedBlePacket) => void;
  reject: (error: Error) => void;
};

let activeScan: BluetoothLEScan | null = null;
let advertisementHandler: ((event: BluetoothAdvertisingEvent) => void) | null = null;

export class WebBluetoothService {
  private profile: BleProfile | null = null;
  private gattServer: BluetoothRemoteGATTServer | null = null;
  private txCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private rxCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private connectedDevice: BluetoothDevice | null = null;
  private rxBuffer: number[] = [];
  private registered = false;
  private queue: PendingRequest[] = [];
  private processing = false;
  private discovered = new Map<string, DiscoveredBleDevice>();

  configure(profile: BleProfile): void {
    if (!profile.Active) {
      throw new BleError(BleErrors.profileUnavailable);
    }
    this.profile = profile;
  }

  clearConfiguration(): void {
    this.profile = null;
  }

  async startScan(onUpdate: (devices: DiscoveredBleDevice[]) => void): Promise<void> {
    this.assertWebBluetooth();
    const profile = this.requireProfile();
    await this.stopScan();
    this.discovered.clear();

    if (isLeScanSupported()) {
      await this.startLeScan(profile, onUpdate);
      return;
    }

    throw new BleError(BleErrors.scanUnsupported);
  }

  async requestDeviceFromPicker(): Promise<DiscoveredBleDevice> {
    this.assertWebBluetooth();
    const profile = this.requireProfile();
    const filters: BluetoothLEScanFilter[] = [];
    if (profile.ServiceUuid.trim()) {
      filters.push({ services: [profile.ServiceUuid] });
    }
    if (profile.PublishedNamePrefix.trim()) {
      filters.push({ namePrefix: profile.PublishedNamePrefix.trim() });
    }
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: filters.length > 0 ? filters : undefined,
        optionalServices: profile.ServiceUuid.trim() ? [profile.ServiceUuid] : [],
        acceptAllDevices: filters.length === 0,
      });
      const name = device.name ?? "";
      if (!matchesAdvertisedName(name, profile.PublishedNamePrefix)) {
        throw new BleError(BleErrors.noDevicesFound);
      }
      const entry: DiscoveredBleDevice = {
        id: device.id,
        name: name || "Unknown device",
        rssi: 0,
        device,
      };
      this.discovered.set(entry.id, entry);
      return entry;
    } catch (error) {
      if (error instanceof BleError) throw error;
      if (error instanceof DOMException) {
        if (error.name === "NotFoundError") {
          throw new BleError(BleErrors.noDevicesFound);
        }
        if (error.name === "NotAllowedError") {
          throw new BleError(BleErrors.permissionDenied);
        }
        if (error.name === "SecurityError") {
          throw new BleError(BleErrors.unsupported);
        }
      }
      throw new BleError(BleErrors.unavailable);
    }
  }

  async stopScan(): Promise<void> {
    if (activeScan) {
      try {
        activeScan.stop();
      } catch {
        // ignore
      }
      activeScan = null;
    }
    if (advertisementHandler && navigator.bluetooth) {
      navigator.bluetooth.removeEventListener("advertisementreceived", advertisementHandler);
      advertisementHandler = null;
    }
  }

  getDiscoveredDevices(): DiscoveredBleDevice[] {
    return [...this.discovered.values()].sort((a, b) => b.rssi - a.rssi);
  }

  async connect(entry: DiscoveredBleDevice): Promise<void> {
    const profile = this.requireProfile();
    await this.stopScan();
    await this.disconnect();

    if (entry.rssi !== 0 && entry.rssi < profile.RssiConnectMinimum) {
      throw new BleError(BleErrors.weakSignal);
    }

    try {
      this.connectedDevice = entry.device;
      const server = await entry.device.gatt?.connect();
      if (!server) {
        throw new BleError(BleErrors.connectionFailed);
      }
      this.gattServer = server;

      const serviceUuid = normalizeUuid(profile.ServiceUuid);
      const matchedService = (await server.getPrimaryServices()).find(
        (service) => normalizeUuid(service.uuid) === serviceUuid,
      );
      if (!matchedService) {
        await this.disconnect();
        throw new BleError(BleErrors.serviceNotFound);
      }

      const characteristics = await matchedService.getCharacteristics();
      const txUuid = normalizeUuid(profile.TxCharacteristicUuid);
      const rxUuid = normalizeUuid(profile.RxCharacteristicUuid);
      const tx = characteristics.find((c) => normalizeUuid(c.uuid) === txUuid);
      const rx = characteristics.find((c) => normalizeUuid(c.uuid) === rxUuid);

      if (!tx) {
        await this.disconnect();
        throw new BleError(BleErrors.txNotFound);
      }
      if (!rx) {
        await this.disconnect();
        throw new BleError(BleErrors.rxNotFound);
      }

      this.txCharacteristic = tx;
      this.rxCharacteristic = rx;
      this.registered = false;
    } catch (error) {
      if (error instanceof BleError) throw error;
      await this.disconnect();
      throw new BleError(BleErrors.connectionFailed);
    }
  }

  async registerReceive(): Promise<void> {
    const profile = this.requireProfile();
    const rx = this.rxCharacteristic;
    if (!rx) {
      throw new BleError(BleErrors.connectionFailed);
    }
    if (!profile.RxUsesNotification) {
      throw new BleError(BleErrors.notificationRequired);
    }
    try {
      await rx.startNotifications();
      rx.addEventListener("characteristicvaluechanged", this.onNotification);
      this.registered = true;
    } catch {
      throw new BleError(BleErrors.notificationFailed);
    }
  }

  async readParameter(code: string): Promise<string> {
    const commandId = parameterByte(code);
    if (commandId === undefined) {
      return "";
    }
    const packet = await this.transact(
      buildBlePacket({ operation: BleProtocolOp.read, commandId }),
    );
    return packet.asString;
  }

  async readDeviceIdentity(): Promise<Record<string, string>> {
    const identity: Record<string, string> = {};
    for (const code of [
      ParameterCodes.serialNumber,
      ParameterCodes.deviceName,
      ParameterCodes.deviceType,
      ParameterCodes.firmwareVersion,
    ]) {
      identity[code] = await this.readParameter(code);
    }
    return identity;
  }

  async disconnect(): Promise<void> {
    const rx = this.rxCharacteristic;
    if (rx) {
      rx.removeEventListener("characteristicvaluechanged", this.onNotification);
      try {
        await rx.stopNotifications();
      } catch {
        // ignore
      }
    }
    this.rxCharacteristic = null;
    this.txCharacteristic = null;
    this.registered = false;
    this.rxBuffer = [];
    this.queue = [];
    this.processing = false;

    if (this.gattServer?.connected) {
      try {
        this.gattServer.disconnect();
      } catch {
        // ignore
      }
    }
    this.gattServer = null;
    this.connectedDevice = null;
  }

  private onNotification = (event: Event): void => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    if (!value) return;
    this.rxBuffer.push(...new Uint8Array(value.buffer));
  };

  private async transact(request: Uint8Array): Promise<ParsedBlePacket> {
    const profile = this.requireProfile();
    if (request.length > profile.MaximumPacketSize) {
      throw new BleError(BleErrors.profileUnavailable);
    }
    return new Promise<ParsedBlePacket>((resolve, reject) => {
      this.queue.push({ request, resolve, reject });
      void this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    const profile = this.requireProfile();
    while (this.queue.length > 0) {
      const pending = this.queue.shift()!;
      try {
        if (!this.registered) {
          await this.registerReceive();
        }
        this.rxBuffer = [];
        const tx = this.txCharacteristic;
        if (!tx) {
          throw new BleError(BleErrors.connectionFailed);
        }
        if (profile.WriteWithResponse) {
          await tx.writeValue(pending.request);
        } else {
          await tx.writeValueWithoutResponse(pending.request);
        }
        const response = await this.waitForResponse(profile.CommandTimeoutMs);
        pending.resolve(response);
      } catch (error) {
        pending.reject(error instanceof Error ? error : new BleError(BleErrors.commandTimeout));
      }
    }
    this.processing = false;
  }

  private async waitForResponse(timeoutMs: number): Promise<ParsedBlePacket> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.rxBuffer.length > 0) {
        const parsed = parseBlePacket(new Uint8Array(this.rxBuffer));
        if (parsed) {
          this.rxBuffer = [];
          return parsed;
        }
      }
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    }
    throw new BleError(BleErrors.commandTimeout);
  }

  private async startLeScan(
    profile: BleProfile,
    onUpdate: (devices: DiscoveredBleDevice[]) => void,
  ): Promise<void> {
    const bluetooth = navigator.bluetooth as Bluetooth & {
      requestLEScan(options: BluetoothLEScanOptions): Promise<BluetoothLEScan>;
    };

    const filters: BluetoothLEScanFilter[] = [];
    if (profile.ServiceUuid.trim()) {
      filters.push({ services: [profile.ServiceUuid] });
    }
    if (profile.PublishedNamePrefix.trim()) {
      filters.push({ namePrefix: profile.PublishedNamePrefix.trim() });
    }

    try {
      activeScan = await bluetooth.requestLEScan({
        filters: filters.length > 0 ? filters : undefined,
        keepRepeatedDevices: true,
        acceptAllAdvertisements: filters.length === 0,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        throw new BleError(BleErrors.permissionDenied);
      }
      throw new BleError(BleErrors.scanUnsupported);
    }

    advertisementHandler = (event: BluetoothAdvertisingEvent) => {
      const device = event.device;
      const name = device.name ?? "";
      if (!matchesAdvertisedName(name, profile.PublishedNamePrefix)) {
        return;
      }
      const rssi = event.rssi ?? -100;
      this.discovered.set(device.id, {
        id: device.id,
        name: name || "Unknown device",
        rssi,
        device,
      });
      onUpdate(this.getDiscoveredDevices());
    };

    navigator.bluetooth.addEventListener("advertisementreceived", advertisementHandler);
    onUpdate(this.getDiscoveredDevices());
  }

  private requireProfile(): BleProfile {
    if (!this.profile) {
      throw new BleError(BleErrors.profileNotConfigured);
    }
    return this.profile;
  }

  private assertWebBluetooth(): void {
    if (!isWebBluetoothSupported()) {
      throw new BleError(BleErrors.unsupported);
    }
  }
}

export const webBluetoothService = new WebBluetoothService();
