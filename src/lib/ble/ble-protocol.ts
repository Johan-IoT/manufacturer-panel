/** Binary BLE packet helpers (AA 55 | Op | Cmd | Len | Data | CRC). Matches mobile app. */
export const BleProtocolOp = {
  read: 0x00,
  write: 0x01,
  execute: 0x02,
} as const;

export interface ParsedBlePacket {
  operation: number;
  commandId: number;
  data: Uint8Array;
  asString: string;
}

function crc16Modbus(data: Uint8Array): number {
  let crc = 0xffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      if ((crc & 0x0001) !== 0) {
        crc = (crc >> 1) ^ 0xa001;
      } else {
        crc >>= 1;
      }
    }
  }
  return crc & 0xffff;
}

export function buildBlePacket(input: {
  operation: number;
  commandId: number;
  data?: Uint8Array;
}): Uint8Array {
  const payload = input.data ?? new Uint8Array(0);
  const crcInput = new Uint8Array(3 + payload.length);
  crcInput[0] = input.operation;
  crcInput[1] = input.commandId;
  crcInput[2] = payload.length;
  if (payload.length > 0) {
    crcInput.set(payload, 3);
  }
  const crc = crc16Modbus(crcInput);
  const packet = new Uint8Array(7 + payload.length);
  packet[0] = 0xaa;
  packet[1] = 0x55;
  packet[2] = input.operation;
  packet[3] = input.commandId;
  packet[4] = payload.length;
  if (payload.length > 0) {
    packet.set(payload, 5);
  }
  packet[5 + payload.length] = crc & 0xff;
  packet[6 + payload.length] = (crc >> 8) & 0xff;
  return packet;
}

export function parseBlePacket(bytes: Uint8Array): ParsedBlePacket | null {
  for (let i = 0; i <= bytes.length - 7; i++) {
    if (bytes[i] !== 0xaa || bytes[i + 1] !== 0x55) continue;
    const operation = bytes[i + 2]!;
    const commandId = bytes[i + 3]!;
    const length = bytes[i + 4]!;
    const end = i + 5 + length + 2;
    if (end > bytes.length) continue;
    const data = bytes.subarray(i + 5, i + 5 + length);
    const crcInput = bytes.subarray(i + 2, i + 5 + length);
    const expected = crc16Modbus(crcInput);
    const received = bytes[i + 5 + length]! | (bytes[i + 5 + length + 1]! << 8);
    if (expected !== received) continue;
    return {
      operation,
      commandId,
      data,
      asString: String.fromCharCode(...data),
    };
  }
  return null;
}

export function encodeBleString(value: string): Uint8Array {
  return new Uint8Array([...value].map((c) => c.charCodeAt(0)));
}
