# Phase 2: NestJS Authorization Infrastructure - Research

**Researched:** 2026-08-11
**Domain:** NestJS Guards, Decorators, Reflector, Prisma RBAC, Clerk Authentication
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **AuthN / AuthZ Separation**: Clerk handles JWT token authentication; local database (Prisma) handles user roles and farm access.
- **Global Roles**: `GlobalRole` enum (`SUPER_ADMIN`, `USER`). Checked against local `User.globalRole`.
- **Farm-Level Roles**: Verified via `FarmUser` join table connecting `farmId`, `userId`, and `roleId`.
- **Super Admin Access**: Global `SUPER_ADMIN` users bypass farm-level membership restrictions across all endpoints (`AUTHZ-04`).
- **Tooling Standard**: `pnpm` exclusively for test and build commands (`pnpm test`, `pnpm run build`).

### The Agent's Discretion
- Metadata keys for `@GlobalRoles()` and `@RequireFarmRole()` decorators.
- Request decoration fields (`request.dbUser` and `request.farmUser`) for sharing database entity contexts within NestJS request lifecycle.

</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Component | Responsibility | Rationale |
|-----------|----------------|-----------|
| `GlobalRoles()` Decorator | Sets handler/controller global role metadata | Standard NestJS metadata annotation pattern using `SetMetadata`. |
| `RequireFarmRole()` Decorator | Sets handler/controller farm role metadata | Standard NestJS metadata annotation pattern using `SetMetadata`. |
| `GlobalRolesGuard` | Validates `User.globalRole` from database using Clerk `sub` ID | Enforces platform-level RBAC (e.g. `SUPER_ADMIN`). |
| `FarmRoleGuard` | Validates farm membership & role; implements Super Admin override | Enforces tenant-level multi-tenant security and super-admin bypass. |
</architectural_responsibility_map>

<research_summary>
## Summary

Phase 2 builds the authorization substrate for NestJS controllers using decorators and guards:
1. **Decorators**: `@GlobalRoles(...roles: GlobalRole[])` and `@RequireFarmRole(...roles: string[])`.
2. **Guards**: `GlobalRolesGuard` and `FarmRoleGuard` relying on NestJS `Reflector` and `PrismaService`.
3. **Super Admin Override**: `FarmRoleGuard` grants immediate access if `dbUser.globalRole === 'SUPER_ADMIN'`.

All scripts and tests will be validated using **`pnpm`**.
</research_summary>

<standard_stack>
## Standard Stack

| Library | Version | Purpose |
|---------|---------|---------|
| `@nestjs/common` | `^10.x` | Guards, Decorators, Reflector, Exceptions |
| `@nestjs/config` | `^3.x` | Configuration service |
| `@prisma/client` | `^6.3.1` | Local database access layer (`User`, `FarmUser`, `Role`) |

### Commands
```bash
cd backend
pnpm run build
pnpm test
```
</standard_stack>

<architecture_patterns>
## Recommended Guard Implementation Pattern

```typescript
@Injectable()
export class GlobalRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<GlobalRole[]>('global_roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const clerkUser = request.user;
    if (!clerkUser?.sub) {
      throw new UnauthorizedException('Unauthenticated user payload');
    }

    let dbUser = request.dbUser;
    if (!dbUser) {
      dbUser = await this.prisma.user.findUnique({
        where: { clerkId: clerkUser.sub },
      });
      if (!dbUser) {
        throw new ForbiddenException('User record not found');
      }
      request.dbUser = dbUser;
    }

    if (requiredRoles.includes(dbUser.globalRole)) {
      return true;
    }

    throw new ForbiddenException('Insufficient global privileges');
  }
}
```
</architecture_patterns>

<Validation Architecture>
## Validation Architecture

1. **Build Check**: `pnpm run build` cleanly compiles TypeScript without errors.
2. **Unit / Integration Tests**: `pnpm test` validates guard logic and decorator metadata parsing.
</Validation Architecture>

---
*Phase: 02-nestjs-authorization-infrastructure*
*Research completed: 2026-08-11*
