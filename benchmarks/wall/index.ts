import * as zod from './zod-idiomatic';
import * as piuma from './piuma';
import * as valibot from './valibot';
import * as arktype from './arktype';
import { run } from '../helpers';
import { config } from '../../src';
import { testData } from './example-data';

function garbled(fn: () => void) {
  const last: any = testData[testData.length - 1];
  const old = last.previews[0].height;
  last.previews[0].height = '100%';
  fn();
  last.previews[0].height = old;
}

// Compare all benchmarks
function compareWallItemBenchmarks() {
  console.log('=== Wall Item Schema Benchmark Comparison ===\n');

  const validations = 200000;
  const schemas = 10000;

  console.log('Zod');
  run('  Validation (✓)', validations / 10, zod.validation);
  garbled(() => run('  Validation (✗)', validations / 10, zod.validation));
  run('  Creation', schemas / 10, zod.schemaCreation);

  console.log('\nPiuma');
  run('  Creation', schemas, piuma.schemaCreation);
  config.jit.threshold = Infinity;
  run('  Validation (✓)(no-opt)', validations, piuma.validation);
  garbled(() => run('  Validation (✗)(no-opt)', validations, piuma.validation));
  config.jit.threshold = 100;
  run('  Validation (✓)(jitted)', validations * 10, piuma.validation);
  garbled(() => run('  Validation (✗)(jitted)', validations * 10, piuma.validation));
  run('  Validation (✓)(quick)', validations * 10, piuma.quick);
  garbled(() => run('  Validation (✗)(quick)', validations * 10, piuma.quick));

  console.log('\nValibot');
  run('  Validation (✓)', validations / 10, valibot.validation);
  garbled(() => run('  Validation (✗)', validations / 10, valibot.validation));
  run('  Creation', schemas, valibot.schemaCreation);

  console.log('\nArktype');
  run('  Creation', schemas / 10, arktype.schemaCreation);
  run('  Validation (✓)', validations * 10, arktype.validation);
  garbled(() => run('  Validation (✗)', validations / 10, arktype.validation));

  console.log('\n=== Comparison Complete ===');
}

compareWallItemBenchmarks();
