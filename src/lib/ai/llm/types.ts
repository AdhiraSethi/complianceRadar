export interface LLMProvider {
  name: string;
  extractFacts(rawDocumentText: string): Promise<unknown>;
}
