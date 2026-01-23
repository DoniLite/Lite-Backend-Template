import { BaseRepository } from "@/core/base.repository";
import { ExampleTable, type ExampleTableType } from "@/db";
import type { CreateExampleDTO } from "../DTO/example.dto";
import { Repository } from "@/core/decorators";

@Repository("ExampleRepository")
export class ExampleRepository extends BaseRepository<
  ExampleTableType,
  typeof ExampleTable,
  CreateExampleDTO,
  Partial<CreateExampleDTO>
> {
  protected table = ExampleTable;
}
