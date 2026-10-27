/** One archive policy for pickers and session actions. Starting at roots also
 * excludes damaged orphan/cyclic category trees without recursive loops. */
export const ACTIVE_CATEGORIES_CTE = `WITH RECURSIVE active_categories(id) AS (
  SELECT id FROM categories WHERE parent_id IS NULL AND archived = 0
  UNION
  SELECT c.id FROM categories c JOIN active_categories p ON c.parent_id = p.id WHERE c.archived = 0
)`
