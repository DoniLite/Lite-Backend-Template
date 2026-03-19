import { IsNumber, IsString } from "class-validator";
import { DTO } from "@/core/decorators";
import { BaseDTO } from "@/core/dto";
import type { UserRoles } from "@/helpers/access.helper";

@DTO()
export class JWTSessionBase extends BaseDTO {
  @IsString()
  userId!: string;

  @IsString()
  role!: UserRoles;

  /**
   * Creates a JWTSessionBase from a user object, properly mapping 'id' to 'userId'
   */
  static fromUser(user: Record<string, unknown>): JWTSessionBase {
    const instance = new JWTSessionBase();
    instance.userId = user.id as string;
    instance.role = user.role as UserRoles;
    return instance;
  }
}

@DTO()
export class JWTSession extends JWTSessionBase {
  @IsNumber()
  exp!: number;
}
