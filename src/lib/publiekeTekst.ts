import { z } from "zod";

export const publiekeRij = z.record(z.unknown()).refine(row => JSON.stringify(row).length <= 128 * 1024);