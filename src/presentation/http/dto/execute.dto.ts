import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ExecuteFileDto {
  @ApiPropertyOptional({
    example: 'main.js',
    description: 'File name passed to the sandbox',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiProperty({
    example: 'console.log(1+2)',
    description: 'Source file contents',
  })
  @IsString()
  @MinLength(0)
  @MaxLength(100_000)
  content!: string;
}

export class ExecuteTestDto {
  @ApiProperty({ example: 't1' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  id!: string;

  @ApiPropertyOptional({ description: 'stdin for this test case' })
  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  stdin?: string;

  @ApiPropertyOptional({
    example: '3',
    description: 'Expected stdout (newline-normalized exact match)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  expectedStdout?: string;

  @ApiProperty({
    enum: ['public', 'hidden'],
    example: 'public',
    description: 'public: full I/O in response; hidden: pass/fail status only',
  })
  @IsIn(['public', 'hidden'])
  visibility!: 'public' | 'hidden';
}

export class ExecuteLimitsDto {
  @ApiPropertyOptional({
    example: 3000,
    minimum: 100,
    maximum: 10_000,
    description: 'Per-run timeout in ms',
  })
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(10_000)
  runTimeoutMs?: number;
}

export class ExecuteContextDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  enrollmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lessonId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  labType?: string;
}

export class ExecuteDto {
  @ApiProperty({
    example: 'javascript',
    description:
      'Language id or alias. Supported: javascript (js, node), python (python3, py), c, cpp (c++, cxx), sql (sqlite, sqlite3). See GET /v1/runtimes for installed engines.',
  })
  @IsString()
  language!: string;

  @ApiPropertyOptional({ description: 'Runtime version pin (optional)' })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiProperty({ type: [ExecuteFileDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExecuteFileDto)
  @ArrayMaxSize(20)
  files!: ExecuteFileDto[];

  @ApiPropertyOptional({
    type: [ExecuteTestDto],
    description: 'When present, mode defaults to judge',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExecuteTestDto)
  @ArrayMaxSize(50)
  tests?: ExecuteTestDto[];

  @ApiPropertyOptional({
    enum: ['judge', 'run'],
    example: 'judge',
    description: 'run = single execution; judge = per-test grade',
  })
  @IsOptional()
  @IsIn(['judge', 'run'])
  mode?: 'judge' | 'run';

  @ApiPropertyOptional({ description: 'stdin for mode=run' })
  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  stdin?: string;

  @ApiPropertyOptional({ type: ExecuteLimitsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExecuteLimitsDto)
  limits?: ExecuteLimitsDto;

  @ApiPropertyOptional({ type: ExecuteContextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExecuteContextDto)
  context?: ExecuteContextDto;
}
