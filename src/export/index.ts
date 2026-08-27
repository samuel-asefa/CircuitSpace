import type { Project, AnalysisResult } from '../types';
import { CATALOG_BY_ID } from '../catalog';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { formatMassG, formatPowerW, formatVoltage, formatCurrentMa } from '../utils/units';

// We need jsPDF types to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => void;
    lastAutoTable: { finalY: number };
  }
}

/**
 * 1. Export Project JSON
 */
export function exportProjectJson(project: Project): void {
  const data = JSON.stringify(project, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  downloadBlob(blob, `${project.name.replace(/\\s+/g, '_')}_v${project.schemaVersion}.cspace.json`);
}

/**
 * 2. Export BOM CSV
 */
export function exportBomCsv(project: Project): void {
  const bom = generateBomData(project);
  const rows = [
    ['Reference', 'Name', 'Category', 'Quantity', 'Mass (g)', 'Unit Cost ($)', 'Total Cost ($)'],
    ...bom.map(b => [
      b.references.join(', '),
      b.name,
      b.category,
      b.quantity.toString(),
      b.totalMassGrams.toFixed(2),
      b.unitCostUsd?.toFixed(2) ?? '—',
      b.totalCostUsd?.toFixed(2) ?? '—',
    ])
  ];
  
  const csvContent = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${project.name.replace(/\\s+/g, '_')}_BOM.csv`);
}

import { buildNetGraph } from '../electrical/netGraph';

/**
 * 3. Export Netlist CSV
 */
export function exportNetlistCsv(project: Project): void {
  // Requires resolving the net graph
  // Since export doesn't run in React component, we can call it manually
  let netsContent = 'Net Name,Pin Count,Connected Pins\n';
  
  for (const sheet of project.sheets) {
    const nets = buildNetGraph(sheet);
    for (const net of nets.values()) {
      const pins = net.pins.map(p => {
        const comp = sheet.components.find(c => c.id === p.componentId);
        const def = comp ? CATALOG_BY_ID[comp.definitionId] : null;
        const pinDef = def?.pins.find(pd => pd.id === p.pinId);
        return `${comp?.refDes ?? '?'}.${pinDef?.label ?? '?'}`;
      }).join(' ');
      
      netsContent += `"${net.name}","${net.pins.length}","${pins}"\n`;
    }
  }
  
  const blob = new Blob([netsContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${project.name.replace(/\s+/g, '_')}_Netlist.csv`);
}

/**
 * 4. Export PDF Design Report
 */
export function exportPdfReport(project: Project, analysis: AnalysisResult | null, svgElement: SVGSVGElement | null): void {
  const doc = new jsPDF();
  let y = 20;

  // Title
  doc.setFontSize(22);
  doc.text(project.name, 14, y);
  y += 10;
  
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y);
  y += 6;
  doc.text(`Author: ${project.author || 'Unknown'}`, 14, y);
  y += 12;

  if (project.description) {
    doc.setTextColor(0);
    const splitDesc = doc.splitTextToSize(project.description, 180);
    doc.text(splitDesc, 14, y);
    y += splitDesc.length * 6 + 6;
  }

  // Stats Table
  if (analysis) {
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text('Design Summary', 14, y);
    y += 6;

    const statsData = [
      ['Total Components', analysis.componentCount.toString()],
      ['Total Nets', analysis.netCount.toString()],
      ['System Voltage', formatVoltage(analysis.powerSources[0]?.voltageV ?? project.settings.nominalBusVoltageV)],
      ['Total Mass', formatMassG(analysis.totalMassGrams)],
      ['Nominal Power', formatPowerW(analysis.totalPowerW)],
      ['Peak Current', formatCurrentMa(analysis.totalPeakCurrentMa)],
      ['Est. Runtime', analysis.estimatedRuntimeHours ? `${analysis.estimatedRuntimeHours.toFixed(1)} hrs` : 'N/A'],
      ['ERC Status', `${analysis.errorCount} Errors, ${analysis.warningCount} Warnings`]
    ];

    doc.autoTable({
      startY: y,
      head: [],
      body: statsData,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } }
    });
    y = doc.lastAutoTable.finalY + 15;
  }

  // BOM Table
  doc.setFontSize(16);
  doc.text('Bill of Materials (BOM)', 14, y);
  y += 6;

  const bom = generateBomData(project);
  const bomRows = bom.map(b => [
    b.references.join(', '),
    b.name,
    b.quantity.toString(),
    b.totalMassGrams.toFixed(1) + ' g'
  ]);

  doc.autoTable({
    startY: y,
    head: [['References', 'Component', 'Qty', 'Mass']],
    body: bomRows,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185] },
    styles: { fontSize: 9 }
  });

  // Schematic Image (if provided)
  if (svgElement) {
    doc.addPage();
    doc.setFontSize(16);
    doc.text('Schematic', 14, 20);
    
    // We would need to serialize SVG, draw it to canvas, then getDataUrl to put in PDF.
    // For now we just add a placeholder text, or we can use svg2pdf if we add the dependency.
    // However, to keep it light without adding another big dependency, 
    // we'll instruct the user how it works.
    // In a full implementation, `canvg` or `html2canvas` is typically used here.
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text('(Schematic render requires converting SVG to image. Use the SVG Export for vector schematic.)', 14, 30);
  }

  doc.save(`${project.name.replace(/\s+/g, '_')}_Report.pdf`);
}

/**
 * 5. Export SVG
 */
export function exportSvg(svgElement: SVGSVGElement, filename: string): void {
  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(svgElement);
  
  // Add namespaces if missing
  if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
    source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if (!source.match(/^<svg[^>]+"http:\/\/www\.w3\.org\/1999\/xlink"/)) {
    source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
  }
  
  source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 6. Export PNG
 */
export function exportPng(svgElement: SVGSVGElement, filename: string): void {
  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(svgElement);
  
  const canvas = document.createElement('canvas');
  // Use bounding box of SVG content
  const bbox = svgElement.getBBox();
  canvas.width = bbox.width + 100;
  canvas.height = bbox.height + 100;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  // White background
  ctx.fillStyle = '#1A1A1A'; // Dark theme background matching app
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  const img = new Image();
  const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  
  img.onload = () => {
    // Center it
    ctx.drawImage(img, 50 - bbox.x, 50 - bbox.y);
    URL.revokeObjectURL(url);
    
    const imgUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = imgUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  img.src = url;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

interface BomEntry {
  defId: string;
  name: string;
  category: string;
  quantity: number;
  references: string[];
  unitMassGrams: number;
  totalMassGrams: number;
  unitCostUsd?: number;
  totalCostUsd?: number;
}

export function generateBomData(project: Project): BomEntry[] {
  const map = new Map<string, BomEntry>();
  
  for (const sheet of project.sheets) {
    for (const comp of sheet.components) {
      const def = CATALOG_BY_ID[comp.definitionId];
      if (!def) continue;
      
      const key = def.id;
      if (!map.has(key)) {
        map.set(key, {
          defId: def.id,
          name: def.name,
          category: def.category,
          quantity: 0,
          references: [],
          unitMassGrams: def.massGrams,
          totalMassGrams: 0,
          unitCostUsd: def.costUsd,
          totalCostUsd: def.costUsd ? 0 : undefined,
        });
      }
      
      const entry = map.get(key)!;
      entry.quantity += 1;
      entry.references.push(comp.refDes);
      entry.totalMassGrams += def.massGrams;
      if (entry.totalCostUsd !== undefined && def.costUsd !== undefined) {
        entry.totalCostUsd += def.costUsd;
      }
    }
  }
  
  const entries = Array.from(map.values());
  // Sort by category then ref
  entries.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.references[0].localeCompare(b.references[0]);
  });
  
  return entries;
}
