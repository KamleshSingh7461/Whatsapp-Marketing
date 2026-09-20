import { IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LaunchCampaignDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(1)
  templateName!: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetTags?: string[];
}
