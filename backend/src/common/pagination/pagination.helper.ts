import { PaginationQueryDto } from './dto/pagination-query.dto';
import { PaginatedResult } from './interfaces/paginated-result.interface';

export interface PrismaModelDelegate<T, K> {
  findMany(this: void, args?: K): Promise<T[]>;
  count(this: void, args?: { where?: unknown }): Promise<number>;
}

export async function paginate<T, K extends { where?: unknown; orderBy?: unknown } = Record<string, unknown>>(
  modelDelegate: PrismaModelDelegate<T, K>,
  queryDto: PaginationQueryDto = {},
  findManyArgs: K = {} as K
): Promise<PaginatedResult<T>> {
  const page = Math.max(1, Number(queryDto.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(queryDto.limit) || 10));
  const skip = (page - 1) * limit;

  let orderBy: unknown = findManyArgs.orderBy;
  if (queryDto.sortBy) {
    const direction = (queryDto.sortOrder || 'DESC').toLowerCase();
    orderBy = { [queryDto.sortBy]: direction };
  }

  const where: unknown = findManyArgs.where;

  const [data, totalItems] = await Promise.all([
    modelDelegate.findMany({
      ...findManyArgs,
      skip,
      take: limit,
      ...(orderBy ? { orderBy } : {}),
    }),
    modelDelegate.count({
      ...(where !== undefined ? { where } : {}),
    }),
  ]);

  const totalPages = Math.ceil(totalItems / limit);

  return {
    data,
    meta: {
      totalItems,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}
