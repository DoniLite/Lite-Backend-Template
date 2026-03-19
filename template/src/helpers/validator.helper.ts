/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Custom validation helpers
 */
import { validate } from "class-validator";

export class ValidatorHelper {
  /**
   * Validate an object against a DTO class
   */
  static async validateDTO<T extends object>(
    dtoClass: new () => T,
    data: any,
  ): Promise<{ valid: boolean; errors?: any[] }> {
    const instance = Object.assign(new dtoClass(), data);
    const errors = await validate(instance);

    if (errors.length > 0) {
      return {
        valid: false,
        errors: errors.map((err) => ({
          property: err.property,
          constraints: err.constraints,
          value: err.value,
        })),
      };
    }

    return { valid: true };
  }

  /**
   * Validate array of objects
   */
  static async validateArray<T extends object>(
    dtoClass: new () => T,
    dataArray: any[],
  ): Promise<{ valid: boolean; errors?: Record<number, any[]> }> {
    const allErrors: Record<number, any[]> = {};
    let hasErrors = false;

    for (let i = 0; i < dataArray.length; i++) {
      const result = await this.validateDTO(dtoClass, dataArray[i]);
      if (!result.valid && result.errors) {
        allErrors[i] = result.errors;
        hasErrors = true;
      }
    }

    return hasErrors ? { valid: false, errors: allErrors } : { valid: true };
  }
}
