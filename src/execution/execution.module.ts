import { Module } from '@nestjs/common';
import { ExecuteCodeUseCase } from '../application/use-cases/execute-code.use-case';
import { ListRuntimesUseCase } from '../application/use-cases/list-runtimes.use-case';
import { Judge } from '../domain/judge';
import { LanguageRegistry } from '../domain/languages';
import { VisibilityFilter } from '../domain/visibility-filter';
import { PistonModule } from '../infrastructure/piston/piston.module';
import { AuthModule } from '../presentation/auth/auth.module';
import { ExecutionController } from '../presentation/http/execution.controller';

@Module({
  imports: [PistonModule, AuthModule],
  controllers: [ExecutionController],
  providers: [
    ExecuteCodeUseCase,
    ListRuntimesUseCase,
    Judge,
    VisibilityFilter,
    LanguageRegistry,
  ],
})
export class ExecutionModule {}
