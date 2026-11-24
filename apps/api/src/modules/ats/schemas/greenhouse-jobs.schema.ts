import { z } from 'zod';

/**
 * The job list of the Greenhouse Job Board API; each job is checked on its own, so one odd job does not fail the board
 */
export const greenhouseJobsSchema = z.object({ jobs: z.array(z.unknown()) });
