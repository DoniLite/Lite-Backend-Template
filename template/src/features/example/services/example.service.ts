import { BaseService } from "@/core/base.service";
import { Service } from "@/core/decorators";
import type { ExampleTableType } from "@/db";
import { CreateExampleDTO } from "../DTO/example.dto";
import { ExampleRepository } from "../repository/example.repository";

@Service()
export class ExampleService extends BaseService<
  ExampleTableType,
  CreateExampleDTO,
  Partial<CreateExampleDTO>,
  ExampleRepository
> {
  constructor() {
    super(new ExampleRepository());
  }
}
