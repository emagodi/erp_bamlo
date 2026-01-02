export type CalcField = {
  code: string; // e.g., A4, B4, C4
  label: string;
  section: 'MATERIALS' | 'LABOUR';
  group?: string; // e.g., FOUNDATION
  kind: 'input' | 'calc';
  expr?: string; // expr-eval expression referencing other codes
};

// Minimal, extensible mapping based on your sheet screenshots.
// You can add more rows aligning with your Excel structure.
export const CALC_FIELDS: CalcField[] = [
  // MATERIALS – FOUNDATION (inputs)
  { code: 'A4', label: 'One Brick wall length', section: 'MATERIALS', group: 'FOUNDATION', kind: 'input' },
  { code: 'B4', label: 'Half Brick wall length', section: 'MATERIALS', group: 'FOUNDATION', kind: 'input' },
  { code: 'D4', label: 'Total Area', section: 'MATERIALS', group: 'FOUNDATION', kind: 'input' },
  { code: 'E4', label: 'Verandah Area', section: 'MATERIALS', group: 'FOUNDATION', kind: 'input' },
  { code: 'G4', label: 'Project Distance', section: 'MATERIALS', group: 'FOUNDATION', kind: 'input' },

  // MATERIALS – FOUNDATION (derived)
  { code: 'C4', label: 'Total Perimeter', section: 'MATERIALS', group: 'FOUNDATION', kind: 'calc', expr: 'A4 + B4' },
  { code: 'F4', label: 'Topsoil Excav', section: 'MATERIALS', group: 'FOUNDATION', kind: 'calc', expr: 'D4 * 0.4' },
  { code: 'H6', label: 'Site Clearance (qty)', section: 'MATERIALS', group: 'FOUNDATION', kind: 'calc', expr: 'D4 + A4' },
  { code: 'I6', label: 'Perimeter Copy', section: 'MATERIALS', group: 'FOUNDATION', kind: 'calc', expr: 'C4' },
  { code: 'K6', label: 'Footing Concrete (qty)', section: 'MATERIALS', group: 'FOUNDATION', kind: 'calc', expr: 'C4 * 0.7 * 0.23' },

  // LABOUR – FOUNDATION (derived mirroring labels)
  { code: 'L1', label: 'Labour: Site Clearance', section: 'LABOUR', group: 'FOUNDATION', kind: 'calc', expr: 'D4 + A4' },
  { code: 'L2', label: 'Labour: Setting Out', section: 'LABOUR', group: 'FOUNDATION', kind: 'calc', expr: 'C4' },
  { code: 'L3', label: 'Labour: Excavation', section: 'LABOUR', group: 'FOUNDATION', kind: 'calc', expr: 'C4' },
  { code: 'L4', label: 'Labour: Footing Concrete', section: 'LABOUR', group: 'FOUNDATION', kind: 'calc', expr: 'C4 * 0.7 * 0.23' },
];

