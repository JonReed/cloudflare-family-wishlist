import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';

export async function privateTokenPrompt(): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      'Open a terminal and run setup:access there to enter the token privately, or supply ACCESS_MANAGEMENT_API_TOKEN from an authorised secret store. Never paste it into chat.'
    );
  }
  const hidden = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    }
  });
  const prompt = createInterface({ input: process.stdin, output: hidden, terminal: true });
  process.stdout.write('Paste the scoped Access token here (input is hidden), then press Enter: ');
  try {
    return (await prompt.question('')).trim();
  } finally {
    prompt.close();
    process.stdout.write('\n');
  }
}
