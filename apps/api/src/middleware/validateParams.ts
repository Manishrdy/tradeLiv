import { Request, Response, NextFunction, Router } from 'express';

/**
 * UUID v4 format: 8-4-4-4-12 hex characters.
 * Also matches the default Prisma uuid() output.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Param names that should be validated as UUIDs.
 * Covers all route params used across the codebase.
 */
const UUID_PARAM_NAMES = [
  'id',
  'roomId',
  'itemId',
  'orderId',
  'poId',
  'projectId',
  'quoteId',
  'lineItemId',
];

/**
 * Registers router.param() handlers for all UUID param names.
 * Express calls param handlers when a matching route is found,
 * giving us access to the actual param values.
 *
 * Returns 400 immediately for malformed IDs instead of hitting the database.
 */
export function registerUuidValidation(router: Router): void {
  for (const paramName of UUID_PARAM_NAMES) {
    router.param(paramName, (req: Request, res: Response, next: NextFunction, value: string) => {
      if (!UUID_REGEX.test(value)) {
        res.status(400).json({ error: `Invalid ${paramName} format.` });
        return;
      }
      next();
    });
  }
}

/**
 * Standalone middleware version — works when req.params is already populated
 * (e.g., inside a route handler chain). Kept for backward compatibility.
 */
export function validateUuidParams(req: Request, res: Response, next: NextFunction) {
  for (const [name, value] of Object.entries(req.params)) {
    if (UUID_PARAM_NAMES.includes(name) && !UUID_REGEX.test(value as string)) {
      res.status(400).json({ error: `Invalid ${name} format.` });
      return;
    }
  }
  next();
}
