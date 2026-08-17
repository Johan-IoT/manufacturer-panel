/// Web Bluetooth and experimental scanning API types for Chrome/Edge.

interface BluetoothLEScanFilter {
  services?: BluetoothServiceUUID[];
  name?: string;
  namePrefix?: string;
}

interface BluetoothLEScanOptions {
  filters?: BluetoothLEScanFilter[];
  keepRepeatedDevices?: boolean;
  acceptAllAdvertisements?: boolean;
}

interface BluetoothLEScan {
  active: boolean;
  stop(): void;
}

interface BluetoothAdvertisingEvent extends Event {
  device: BluetoothDevice;
  rssi?: number;
  name?: string;
}

interface Bluetooth {
  requestLEScan(options: BluetoothLEScanOptions): Promise<BluetoothLEScan>;
  addEventListener(
    type: "advertisementreceived",
    listener: (event: BluetoothAdvertisingEvent) => void,
  ): void;
  removeEventListener(
    type: "advertisementreceived",
    listener: (event: BluetoothAdvertisingEvent) => void,
  ): void;
}

export {};
