export enum UserRoles {
  ADMIN = "admin",
  USER = "user",
  MAINTAINER = "maintainer",
}

export const READ_ACCESS = [
  UserRoles.ADMIN,
  UserRoles.MAINTAINER,
  UserRoles.USER,
];
export const WRITE_ACCESS = [UserRoles.ADMIN, UserRoles.MAINTAINER];
export const DELETE_ACCESS = [UserRoles.ADMIN];

export function canAccess(role: UserRoles, access: string[]) {
  return access.includes(role);
}
