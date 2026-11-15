export function createReportDeltaIcon(height: string, strokeColor: string): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.style.height = height;
  svg.style.width = 'auto';
  svg.style.display = 'block';
  svg.style.flexShrink = '0';

  const triangle = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  triangle.setAttribute('d', 'M12 3L22 18H2Z');
  triangle.setAttribute('stroke', strokeColor);
  triangle.setAttribute('stroke-width', '2.5');
  triangle.setAttribute('stroke-linecap', 'round');
  triangle.setAttribute('stroke-linejoin', 'round');

  const baseline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  baseline.setAttribute('d', 'M2 22H22');
  baseline.setAttribute('stroke', strokeColor);
  baseline.setAttribute('stroke-width', '2.5');
  baseline.setAttribute('stroke-linecap', 'round');
  baseline.setAttribute('stroke-linejoin', 'round');

  svg.append(triangle, baseline);
  return svg;
}
