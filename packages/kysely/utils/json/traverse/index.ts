import type { ExpressionBuilder, StringReference } from "kysely";
import { sql } from "kysely";

export function traverseJSON<DB, TB extends keyof DB>(
  eb: ExpressionBuilder<DB, TB>,
  column: StringReference<DB, TB>,
  path: string | [string, ...string[]]
) {
  if (!Array.isArray(path)) {
    path = [path];
  }

  // Use parameter binding for each path segment to prevent SQL injection
  const pathSql = path
    .map((item) => sql`'${item}'`)
    .reduce((prev, curr) => sql`${prev}->${curr}`);

  return sql`${sql.ref(column)}->${pathSql}`;
}
