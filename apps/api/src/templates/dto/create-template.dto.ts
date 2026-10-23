import { IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { TemplateCategory } from '@prisma/client';

const CATEGORIES = Object.values(TemplateCategory);

export class CreateTemplateDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  language!: string;

  @IsIn(CATEGORIES)
  category!: TemplateCategory;

  // Raw WhatsApp template component structure (header/body/footer/buttons)
  @IsObject()
  bodyJson!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  sampleVariables?: Record<string, string>;

  @IsOptional()
  @IsString()
  warning?: string;
}


/** An edit of an existing template. Name and language cannot change on Meta, so they are not part of it. */
export class UpdateTemplateDto {
  @IsOptional()
  @IsIn(CATEGORIES)
  category?: TemplateCategory;

  @IsObject()
  bodyJson!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  sampleVariables?: Record<string, string>;
}
