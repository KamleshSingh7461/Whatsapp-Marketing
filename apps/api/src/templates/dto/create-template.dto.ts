import { IsIn, IsObject, IsString, MinLength } from 'class-validator';
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
}
