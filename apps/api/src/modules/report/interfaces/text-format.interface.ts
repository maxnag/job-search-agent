import type { styleText } from 'node:util';

/**
 * A colour, a modifier or a list of them, as `styleText` takes them
 */
export type TextFormat = Parameters<typeof styleText>[0];
