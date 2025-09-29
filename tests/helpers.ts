import { config } from '../src/common';
import { test, describe } from 'node:test';

export function testBothModes(name: string, fn: (ctx: { test: typeof test }) => void) {
  for (const threshold of [Infinity, 0]) {
    config.jit.threshold = threshold;
    describe(`${name} (${threshold === Infinity ? 'no JIT' : 'JIT'})`, () => {
      fn({ test });
    });
  }
}
