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
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsString()
  @MinLength(0)
  @MaxLength(100_000)
  content!: string;
}

export class ExecuteTestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  stdin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  expectedStdout?: string;

  @IsIn(['public', 'hidden'])
  visibility!: 'public' | 'hidden';
}

export class ExecuteLimitsDto {
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(10_000)
  runTimeoutMs?: number;
}

export class ExecuteContextDto {
  @IsOptional()
  @IsString()
  enrollmentId?: string;

  @IsOptional()
  @IsString()
  lessonId?: string;

  @IsOptional()
  @IsString()
  labType?: string;
}

export class ExecuteDto {
  @IsString()
  language!: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExecuteFileDto)
  @ArrayMaxSize(20)
  files!: ExecuteFileDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExecuteTestDto)
  @ArrayMaxSize(50)
  tests?: ExecuteTestDto[];

  @IsOptional()
  @IsIn(['judge', 'run'])
  mode?: 'judge' | 'run';

  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  stdin?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ExecuteLimitsDto)
  limits?: ExecuteLimitsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ExecuteContextDto)
  context?: ExecuteContextDto;
}
