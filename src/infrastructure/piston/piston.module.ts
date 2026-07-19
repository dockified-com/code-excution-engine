import { Module } from '@nestjs/common';
import { CODE_RUNNER } from '../../application/ports/code-runner.port';
import { PistonClient } from './piston.client';

@Module({
  providers: [PistonClient, { provide: CODE_RUNNER, useClass: PistonClient }],
  exports: [CODE_RUNNER, PistonClient],
})
export class PistonModule {}
