function removeJsonComments(input: string): string {
  let output = '';
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const next = input[index + 1];

    if (inString) {
      output += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }

    if (character === '"') {
      inString = true;
      output += character;
      continue;
    }

    if (character === '/' && next === '/') {
      while (index < input.length && input[index] !== '\n') index += 1;
      output += '\n';
      continue;
    }

    if (character === '/' && next === '*') {
      index += 2;
      while (index < input.length && !(input[index] === '*' && input[index + 1] === '/')) {
        output += input[index] === '\n' ? '\n' : ' ';
        index += 1;
      }
      index += 1;
      continue;
    }

    output += character;
  }

  return output;
}

function removeTrailingCommas(input: string): string {
  let output = '';
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (inString) {
      output += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      output += character;
      continue;
    }
    if (character === ',') {
      let lookahead = index + 1;
      while (/\s/.test(input[lookahead] ?? '')) lookahead += 1;
      if (input[lookahead] === '}' || input[lookahead] === ']') continue;
    }
    output += character;
  }
  return output;
}

export function parseJsoncObject(
  source: string,
  label = 'wrangler.jsonc'
): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(removeTrailingCommas(removeJsonComments(source)));
  } catch {
    throw new Error(`${label} is not valid JSONC.`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${label} must contain an object.`);
  }
  return parsed as Record<string, unknown>;
}
