import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  ExecuteCodeUseCase,
  type ExecuteCodeInput,
} from '../../application/use-cases/execute-code.use-case';
import { ListRuntimesUseCase } from '../../application/use-cases/list-runtimes.use-case';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { ExecuteDto } from './dto/execute.dto';

@ApiTags('execution')
@ApiBearerAuth('api-key')
@Controller('v1')
@UseGuards(ApiKeyGuard)
export class ExecutionController {
  constructor(
    private readonly executeCode: ExecuteCodeUseCase,
    private readonly listRuntimes: ListRuntimesUseCase,
  ) {}

  @Post('execute')
  @ApiOperation({
    summary: 'Run or judge student code',
    description:
      'mode=run: one sandbox run. mode=judge (or tests present): run each test, compare stdout, filter hidden details.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid API key' })
  execute(@Body() body: ExecuteDto) {
    return this.executeCode.execute(mapDtoToInput(body));
  }

  @Get('runtimes')
  @ApiOperation({
    summary: 'List allowlisted runtimes',
    description:
      'Allowlisted runtimes installed on Piston (LanguageRegistry-filtered).',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid API key' })
  runtimes() {
    return this.listRuntimes.execute();
  }
}

function mapDtoToInput(dto: ExecuteDto): ExecuteCodeInput {
  return {
    language: dto.language,
    ...(dto.version !== undefined ? { version: dto.version } : {}),
    files: dto.files.map((f) => ({
      ...(f.name !== undefined ? { name: f.name } : {}),
      content: f.content,
    })),
    ...(dto.tests !== undefined
      ? {
          tests: dto.tests.map((t) => ({
            id: t.id,
            ...(t.stdin !== undefined ? { stdin: t.stdin } : {}),
            ...(t.expectedStdout !== undefined
              ? { expectedStdout: t.expectedStdout }
              : {}),
            visibility: t.visibility,
          })),
        }
      : {}),
    ...(dto.mode !== undefined ? { mode: dto.mode } : {}),
    ...(dto.stdin !== undefined ? { stdin: dto.stdin } : {}),
    ...(dto.limits !== undefined
      ? {
          limits: {
            ...(dto.limits.runTimeoutMs !== undefined
              ? { runTimeoutMs: dto.limits.runTimeoutMs }
              : {}),
          },
        }
      : {}),
    ...(dto.context !== undefined
      ? {
          context: {
            ...(dto.context.enrollmentId !== undefined
              ? { enrollmentId: dto.context.enrollmentId }
              : {}),
            ...(dto.context.lessonId !== undefined
              ? { lessonId: dto.context.lessonId }
              : {}),
            ...(dto.context.labType !== undefined
              ? { labType: dto.context.labType }
              : {}),
          },
        }
      : {}),
  };
}
