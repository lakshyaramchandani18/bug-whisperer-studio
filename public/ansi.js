/**
 * Minimalist, robust ANSI to HTML converter
 */
export function ansiToHtml(text) {
  if (!text) return '';

  // Escape basic HTML
  let out = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const ansiColors = {
    '30': 'color: #64748b', // black / dim
    '31': 'color: #ef4444; font-weight: 600', // red
    '32': 'color: #10b981', // green
    '33': 'color: #f59e0b', // yellow
    '34': 'color: #3b82f6', // blue
    '35': 'color: #a855f7', // magenta
    '36': 'color: #06b6d4', // cyan
    '37': 'color: #f1f5f9', // white
    '90': 'color: #94a3b8', // bright black / gray
    '91': 'color: #f87171', // bright red
    '92': 'color: #34d399', // bright green
    '93': 'color: #fbbf24', // bright yellow
    '94': 'color: #60a5fa', // bright blue
    '95': 'color: #c084fc', // bright magenta
    '96': 'color: #22d3ee', // bright cyan
    '97': 'color: #ffffff; font-weight: bold', // bright white
    '1': 'font-weight: bold',
    '2': 'opacity: 0.7',
    '3': 'font-style: italic',
    '4': 'text-decoration: underline'
  };

  // Replace ANSI escape codes
  // Matches \u001b[...m
  out = out.replace(/\u001b\[([0-9;]+)m/g, (match, seq) => {
    if (seq === '0' || seq === '') {
      return '</span>';
    }
    const codes = seq.split(';');
    const styles = [];
    for (const code of codes) {
      if (ansiColors[code]) {
        styles.push(ansiColors[code]);
      }
    }
    if (styles.length > 0) {
      return `<span style="${styles.join('; ')}">`;
    }
    return '';
  });

  return out;
}
