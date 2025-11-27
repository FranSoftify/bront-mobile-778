export interface ExecutableOperation {
  method: string;
  endpoint: string;
  params?: Record<string, unknown>;
}

const VALID_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const FACEBOOK_ENDPOINT_PATTERN = /^\/\d+/;

function isValidOperation(op: unknown): op is ExecutableOperation {
  if (!op || typeof op !== "object") return false;
  
  const obj = op as Record<string, unknown>;
  
  if (typeof obj.method !== "string" || !VALID_METHODS.includes(obj.method.toUpperCase())) {
    return false;
  }
  
  if (typeof obj.endpoint !== "string" || !FACEBOOK_ENDPOINT_PATTERN.test(obj.endpoint)) {
    return false;
  }
  
  if (obj.params !== undefined && (typeof obj.params !== "object" || obj.params === null)) {
    return false;
  }
  
  return true;
}

function cleanJsonString(str: string): string {
  return str
    .replace(/\\n/g, " ")
    .replace(/\n/g, " ")
    .replace(/\r/g, " ")
    .replace(/\t/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function hasExecutableOperations(content: string): boolean {
  if (!content || typeof content !== "string") return false;
  
  const jsonArrayPattern = /\[\s*\{[\s\S]*?\}\s*\]/g;
  const jsonObjectPattern = /\{[\s\S]*?"method"[\s\S]*?"endpoint"[\s\S]*?\}/g;
  
  const arrayMatches = content.match(jsonArrayPattern) || [];
  const objectMatches = content.match(jsonObjectPattern) || [];
  
  for (const match of [...arrayMatches, ...objectMatches]) {
    try {
      const cleaned = cleanJsonString(match);
      const parsed = JSON.parse(cleaned);
      
      if (Array.isArray(parsed)) {
        if (parsed.some(isValidOperation)) return true;
      } else if (isValidOperation(parsed)) {
        return true;
      }
    } catch {
      continue;
    }
  }
  
  return false;
}

export function extractExecutableOperations(content: string): ExecutableOperation[] {
  if (!content || typeof content !== "string") return [];
  
  const operations: ExecutableOperation[] = [];
  
  const jsonArrayPattern = /\[\s*\{[\s\S]*?\}\s*\]/g;
  const jsonObjectPattern = /\{[\s\S]*?"method"[\s\S]*?"endpoint"[\s\S]*?\}/g;
  
  const arrayMatches = content.match(jsonArrayPattern) || [];
  
  for (const match of arrayMatches) {
    try {
      const cleaned = cleanJsonString(match);
      const parsed = JSON.parse(cleaned);
      
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (isValidOperation(item)) {
            operations.push({
              method: item.method.toUpperCase(),
              endpoint: item.endpoint,
              params: item.params,
            });
          }
        }
      }
    } catch {
      continue;
    }
  }
  
  if (operations.length === 0) {
    const objectMatches = content.match(jsonObjectPattern) || [];
    
    for (const match of objectMatches) {
      try {
        const cleaned = cleanJsonString(match);
        const parsed = JSON.parse(cleaned);
        
        if (isValidOperation(parsed)) {
          const alreadyExists = operations.some(
            (op) => op.endpoint === parsed.endpoint && op.method === parsed.method
          );
          
          if (!alreadyExists) {
            operations.push({
              method: parsed.method.toUpperCase(),
              endpoint: parsed.endpoint,
              params: parsed.params,
            });
          }
        }
      } catch {
        continue;
      }
    }
  }
  
  return operations;
}
