import { z } from 'zod';

/**
 * The company a Comeet hosted page embeds (`COMPANY_DATA`); only the name is read
 */
export const comeetCompanySchema = z.object({ name: z.string().min(1) });
