import { describe, expect, it } from "vitest";

import { decryptMessageBody, encryptMessageBody } from "@/lib/messenger-crypto.server";

const ENV = { MESSENGER_MESSAGE_KEY: "test-key-material-with-at-least-32-characters!!" };

describe("messenger message encryption", () => {
  it("round-trips a Bengali message body", async () => {
    const ciphertext = await encryptMessageBody("আসসালামু আলাইকুম, ফ্ল্যাটের দাম কত?", ENV);
    expect(ciphertext).not.toBeNull();
    expect(ciphertext).toMatch(/^v1\./);
    expect(ciphertext).not.toContain("ফ্ল্যাট");
    expect(await decryptMessageBody(ciphertext!, ENV)).toBe("আসসালামু আলাইকুম, ফ্ল্যাটের দাম কত?");
  });

  it("produces a fresh IV per message, so identical bodies differ", async () => {
    const first = await encryptMessageBody("same text", ENV);
    const second = await encryptMessageBody("same text", ENV);
    expect(first).not.toBe(second);
  });

  it("fails closed when the server key is missing", async () => {
    expect(await encryptMessageBody("hello", {})).toBeNull();
    expect(await decryptMessageBody("v1.abc.def", {})).toBeNull();
  });

  it("refuses a short key", async () => {
    expect(await encryptMessageBody("hello", { MESSENGER_MESSAGE_KEY: "short" })).toBeNull();
  });

  it("detects tampered ciphertext", async () => {
    const ciphertext = await encryptMessageBody("original", ENV);
    const parts = ciphertext!.split(".");
    const tampered = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -2)}aa`;
    expect(await decryptMessageBody(tampered, ENV)).toBeNull();
  });

  it("refuses the wrong key", async () => {
    const ciphertext = await encryptMessageBody("secret", ENV);
    const other = { MESSENGER_MESSAGE_KEY: "a-different-key-with-at-least-32-characters!" };
    expect(await decryptMessageBody(ciphertext!, other)).toBeNull();
  });

  it("rejects unknown formats", async () => {
    expect(await decryptMessageBody("plaintext", ENV)).toBeNull();
    expect(await decryptMessageBody("v2.abc.def", ENV)).toBeNull();
    expect(await decryptMessageBody("v1.only-two", ENV)).toBeNull();
  });
});
