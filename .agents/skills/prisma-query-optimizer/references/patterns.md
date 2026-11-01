# Prisma Optimization Patterns

## Batch Operations

### Use createMany for Bulk Inserts
```typescript
// BAD
for (const item of items) {
  await prisma.item.create({ data: item });
}

// GOOD
await prisma.item.createMany({ data: items });
```

### Use Transactions for Related Operations
```typescript
// GOOD: Atomic and efficient
await prisma.$transaction([
  prisma.user.create({ data: userData }),
  prisma.profile.create({ data: profileData }),
  prisma.settings.create({ data: settingsData }),
]);
```

### Interactive Transactions for Complex Logic
```typescript
await prisma.$transaction(async (tx) => {
  const user = await tx.user.findUnique({ where: { id } });
  if (user.balance < amount) throw new Error('Insufficient funds');

  await tx.user.update({
    where: { id },
    data: { balance: { decrement: amount } }
  });
});
```

## Cursor-Based Pagination

For large datasets, cursor pagination outperforms offset:
```typescript
// Offset pagination (slow on large tables)
const page = await prisma.post.findMany({
  skip: 10000,
  take: 20
});

// Cursor pagination (consistent performance)
const page = await prisma.post.findMany({
  take: 20,
  cursor: { id: lastSeenId },
  skip: 1 // Skip the cursor itself
});
```

## Raw Queries for Complex Operations

When Prisma's query builder is insufficient:
```typescript
// Complex aggregation
const stats = await prisma.$queryRaw`
  SELECT
    DATE_TRUNC('day', created_at) as day,
    COUNT(*) as count,
    SUM(amount) as total
  FROM orders
  WHERE created_at > ${startDate}
  GROUP BY DATE_TRUNC('day', created_at)
  ORDER BY day DESC
`;
```

## Selective Loading with Fluent API

Load relations conditionally:
```typescript
const user = await prisma.user.findUnique({ where: { id } });

// Only load posts if needed
if (needPosts) {
  const posts = await prisma.user
    .findUnique({ where: { id } })
    .posts({ where: { published: true } });
}
```

## Composite Indexes

For queries with multiple conditions:
```prisma
model Order {
  id        Int      @id @default(autoincrement())
  userId    Int
  status    String
  createdAt DateTime

  // Composite index for common query pattern
  @@index([userId, status])
  @@index([status, createdAt])
}
```

## Query Logging for Debugging

Enable in development to identify slow queries:
```typescript
const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' }
  ]
});

prisma.$on('query', (e) => {
  if (e.duration > 100) {
    console.warn(`Slow query (${e.duration}ms):`, e.query);
  }
});
```

## Connection Pooling

Configure for production:
```
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=30"
```

## Soft Deletes Pattern

Efficient soft delete implementation:
```prisma
model Post {
  id        Int       @id
  deletedAt DateTime?

  @@index([deletedAt]) // Index for filtering
}
```

```typescript
// Middleware to auto-filter deleted records
prisma.$use(async (params, next) => {
  if (params.model === 'Post' && params.action === 'findMany') {
    params.args.where = { ...params.args.where, deletedAt: null };
  }
  return next(params);
});
```

## Distinct Queries

Avoid fetching duplicates:
```typescript
const uniqueCategories = await prisma.post.findMany({
  distinct: ['category'],
  select: { category: true }
});
```

## Aggregate Operations

Use built-in aggregations instead of fetching all data:
```typescript
const stats = await prisma.order.aggregate({
  _sum: { amount: true },
  _avg: { amount: true },
  _count: true,
  where: { status: 'completed' }
});
```

## GroupBy for Analytics

```typescript
const salesByCategory = await prisma.order.groupBy({
  by: ['category'],
  _sum: { amount: true },
  _count: { id: true },
  orderBy: { _sum: { amount: 'desc' } },
  take: 10
});
```
