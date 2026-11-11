// The one rule for a link Foxing stores and later puts in an href or src: an absolute
// http(s) URL, never javascript: or data:, at most `max` characters.
import { z } from "zod";

export const webUrl = (max = 2000) => z.url({ protocol: /^https?$/ }).max(max);
