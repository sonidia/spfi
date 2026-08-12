export function maskGraphqlIgnoredContent(document: string): string {
  let output = "";
  let index = 0;

  while (index < document.length) {
    if (document[index] === "#") {
      while (index < document.length && document[index] !== "\n") {
        output += " ";
        index += 1;
      }
      continue;
    }

    if (document.startsWith('"""', index)) {
      output += "   ";
      index += 3;
      while (index < document.length && !document.startsWith('"""', index)) {
        output += document[index] === "\n" ? "\n" : " ";
        index += 1;
      }
      if (index < document.length) {
        output += "   ";
        index += 3;
      }
      continue;
    }

    if (document[index] === '"') {
      output += " ";
      index += 1;
      while (index < document.length) {
        const character = document[index];
        output += character === "\n" ? "\n" : " ";
        index += 1;
        if (character === "\\" && index < document.length) {
          output += " ";
          index += 1;
        } else if (character === '"') {
          break;
        }
      }
      continue;
    }

    output += document[index];
    index += 1;
  }

  return output;
}
