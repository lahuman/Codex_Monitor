// PE/COFF Machine is part of the built executable, not the installer's stub.
export function executableArchitecture(bytes) {
  if (bytes.length < 64 || bytes.toString("ascii", 0, 2) !== "MZ")
    throw new Error("Missing DOS executable header.");
  const offset = bytes.readUInt32LE(0x3c);
  if (offset < 64 || offset + 6 > bytes.length ||
      bytes.toString("ascii", offset, offset + 4) !== "PE\0\0")
    throw new Error("Invalid PE/COFF header.");
  const machine = bytes.readUInt16LE(offset + 4);
  if (machine !== 0x8664) throw new Error(`Expected x64 executable; PE machine is 0x${machine.toString(16)}.`);
  return "x64";
}
