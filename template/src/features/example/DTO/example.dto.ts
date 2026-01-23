import { DTO } from "@/core/decorators";
import { CreateBase, PartialDTO, BaseDTO } from "@/core/dto";
import { IsString, IsOptional } from "class-validator";
import { ExampleTable } from "@/db";

// Auto-generated DTO from schema (excludes nothing in this case)
export const ExampleBase = CreateBase(ExampleTable);

@DTO()
export class CreateExampleDTO extends BaseDTO {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export const UpdateExampleDTO = PartialDTO(CreateExampleDTO);
