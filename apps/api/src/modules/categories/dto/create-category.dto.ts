import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Same slug convention as `CreateChannelDto` — lowercase, hyphen-separated. */
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export class CreateCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(SLUG_PATTERN, {
    message: 'Slug may only contain lowercase letters, numbers and single hyphens',
  })
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  thumbnail?: string;
}
