/**
 * Sugiere el próximo nombre secuencial ("Zona 4", "Cerco 2") a partir de los
 * nombres existentes. Usa el mayor número encontrado + 1, así no se repite un
 * número aunque se haya borrado algún elemento intermedio.
 */
export function suggestNextName(prefix: string, existingNames: string[]): string {
  const pattern = new RegExp(`^${prefix}\s+(\d+)$`, 'i');
  const maxNumber = existingNames.reduce((max, name) => {
    const match = name.trim().match(pattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix} ${maxNumber + 1}`;
}
