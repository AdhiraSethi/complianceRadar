import type { SourceParser } from '../types';
import { cbicGstParser } from './cbic-gst';

const parsers: Record<string, SourceParser> = {
  cbic_gst: cbicGstParser,
};

export function getParser(parserType: string): SourceParser {
  const parser = parsers[parserType];
  if (!parser) {
    throw new Error(`Unsupported parser type: ${parserType}`);
  }
  return parser;
}
