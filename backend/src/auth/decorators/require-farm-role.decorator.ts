import { SetMetadata } from '@nestjs/common';

export const REQUIRE_FARM_ROLE_KEY = 'require_farm_role';

export const RequireFarmRole = (...roles: string[]) => SetMetadata(REQUIRE_FARM_ROLE_KEY, roles);
