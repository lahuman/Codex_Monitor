import { test } from "node:test";
import assert from "node:assert/strict";
import { executableArchitecture } from "./pe.mjs";
function fixture(machine) {
  const bytes = Buffer.alloc(96);
  bytes.write("MZ"); bytes.writeUInt32LE(64, 0x3c);
  bytes.write("PE\0\0", 64); bytes.writeUInt16LE(machine, 68);
  return bytes;
}
test("Windows packaging accepts x64 and rejects other architectures", () => {
  assert.equal(executableArchitecture(fixture(0x8664)), "x64");
  for (const other of [0x14c, 0xaa64, 0])
    assert.throws(() => executableArchitecture(fixture(other)), /Expected x64/);
});
test("Windows packaging rejects malformed/truncated executable headers", () => {
  assert.throws(() => executableArchitecture(Buffer.alloc(20)), /DOS/);
  const bytes = fixture(0x8664); bytes.writeUInt32LE(0xffffffff, 0x3c);
  assert.throws(() => executableArchitecture(bytes), /PE\/COFF/);
  const invalid = fixture(0x8664); invalid[64] = 0;
  assert.throws(() => executableArchitecture(invalid), /PE\/COFF/);
});
