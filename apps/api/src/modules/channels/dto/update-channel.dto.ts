import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export class UpdateChannelDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(SLUG_PATTERN, {
    message: 'Slug may only contain lowercase letters, numbers and single hyphens',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  banner?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;
}
