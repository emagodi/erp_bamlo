export type QuoteLineSource = {
  code: string; // cell code from takeoff matrix
  description: string;
  unit?: string;
  rate?: number; // default unit price
  section?: string; // optional grouping
};

// Define how computed cells map to quotation line items.
// Extend this list with all items you want on the printed quotation.
export const QUOTE_LINE_MAP: QuoteLineSource[] = [
  // FOUNDATION (examples)
  { code: 'A15', description: 'Common bricks', unit: 'no', rate: 0.16, section: 'FOUNDATION' },
  { code: 'B8+8', description: 'River sand', unit: 'm3', rate: 20.0, section: 'FOUNDATION' },
  { code: 'C8+1', description: 'Pit sand', unit: 'm3', rate: 20.0, section: 'FOUNDATION' },
  { code: 'D8+8', description: '19mm Grenite Quarry Stone aggregate', unit: 'm3', rate: 45.0, section: 'FOUNDATION' },
  { code: 'G7', description: 'Imported  inert granular fill/Hrdcore', unit: 'm3', rate: 10.0, section: 'FOUNDATION' },
  { code: 'F15', description: 'Cement PC 15 (50kg bags)', unit: 'bags', rate: 12.50, section: 'FOUNDATION' },
  //{ code: 'F15', description: 'Cement (50kg bag)', unit: 'bags', rate: 12.50, section: 'FOUNDATION' },
  { code: 'G12*5', description: 'Termite Poison', unit: 'litre', rate: 0.90, section: 'FOUNDATION' },
  { code: 'D4', description: '250 Micron black polythene sheeting', unit: 'm2', rate: 1.0, section: 'FOUNDATION' },
  { code: 'E7', description: 'Brickforce for one brick wall (20 metre rolls) Ref C2', unit: 'rolls', rate: 2.50, section: 'FOUNDATION' },
  { code: 'F7', description: 'Brickforce for half brick wall (20 metre rolls) Ref C2', unit: 'rolls', rate: 2.50, section: 'FOUNDATION' },
  { code: 'D16', description: 'Transport', unit: 'Km', rate: 0.65, section: 'FOUNDATION' },
  

  // SUPERSTRUCTURE (updates requested)
  { code: 'B45', description: 'Pit sand', unit: 'm3', rate: 20, section: 'SUPERSTRUCTURE' },
  { code: 'A45+1', description: 'River Sand', unit: 'm3', rate: 20, section: 'SUPERSTRUCTURE' },
  { code: 'D22+D33+G22', description: 'Cement PC 15 (50kg bags)', unit: 'bags', rate: 12.5, section: 'SUPERSTRUCTURE' },
 // {code: '', description: '19mm Grenite Quarry Stone aggrecates', unit: 'm3', rate: 45, section: 'SUPERSTRUCTURE' },
  { code: 'A36+A25', description: 'Common bricks', unit: 'no', rate: 0.16, section: 'SUPERSTRUCTURE' },
  { code: 'B54', description: 'Damp proof course for one brick wall (22 metre rolls) (230mm)', unit: 'rolls', rate: 3.0, section: 'SUPERSTRUCTURE' },
  { code: 'A54', description: 'Damp proof course for half brick wall (22 metre rolls) (115mm)', unit: 'rolls', rate: 2.0, section: 'SUPERSTRUCTURE' },
  { code: 'F45', description: 'Brickforce for one brick wall (20 metre rolls)  (230mm)', unit: 'rolls', rate: 2.50, section: 'SUPERSTRUCTURE' },
  { code: 'G45', description: 'Brickforce for half  brick wall (20 metre rolls)(115mm)', unit: 'rolls', rate: 2.50, section: 'SUPERSTRUCTURE' },
  { code: 'D48', description: 'Y16 reinforcemet steel', unit: 'Length', rate: 8.80, section: 'SUPERSTRUCTURE' },
  { code: 'F54+D45', description: 'Y12 reinforcemet steel', unit: 'Length', rate: 5.20, section: 'SUPERSTRUCTURE' },
  { code: 'E45', description: 'Y10 reinforcement steel', unit: 'Length', rate: 3.90, section: 'SUPERSTRUCTURE' },
  { code: 'E54', description: 'Bailing wire', unit: 'kgs', rate: 3.0, section: 'SUPERSTRUCTURE' },
  { code: 'C29', description: 'Transport', unit: 'Km', rate: 0.65, section: 'SUPERSTRUCTURE' },


  // METALWORK
  // { code: 'A66', description: ' Door Frame size 815 x 115 mm.', unit: 'Length', rate: 5.20, section: 'METALWORK' },
  // { code: 'B66', description: 'Door Frame Size  815x 230', unit: 'Length', rate: 3.90, section: 'METALWORK' },

  //PLASTERING
  { code: 'E22+E33', description: 'Cement PC 15 (50kg bags)', unit: 'bags', rate: 12.5, section: 'PLASTERING' },
   { code: 'H22-150', description: 'One coat 1:4 cement sand plaster finished with a wood float on internal walls.', unit: 'm2', rate: 2.50, section: 'PLASTERING' },
   { code: 'I22', description: 'One coat 1:4 cement sand plaster finished with a wood float on extenal wall', unit: 'm3', rate: 2.50, section: 'PLASTERING' },
  // { code: 'D71', description: 'Transport', unit: 'Km', rate: 0.65, section: 'PLASTERING' },

  //EXTERNAL PLASTERING
  { code: 'F22+F33+8', description: 'Cement PC 15 (50kg bags)', unit: 'bags', rate: 12.5, section: 'EXTERNAL PLASTERING' },
   { code: 'D52', description: 'Pit sand', unit: 'cm3', rate: 20, section: 'EXTERNAL PLASTERING' },
  // { code: 'H71', description: 'River sand', unit: 'm3', rate: 20, section: 'EXTERNAL PLASTERING' },
  // { code: 'I71', description: 'Transport', unit: 'Km', rate: 0.65, section: 'EXTERNAL PLASTERING' },

  // GRANO/POWERVLOAT FLOOR 
  { code: 'D25', description: 'Cement PC 15 (50kg bags)', unit: 'bags', rate: 12.5, section: 'GRANO/POWERVLOAT FLOOR' },
  { code: 'J22*0.05', description: 'River sand', unit: 'm3', rate: 20, section: 'GRANO/POWERVLOAT FLOOR' },
//  { code: 'G52', description: 'Transport', unit: 'Km', rate: 0.65, section: 'GRANO/POWERVLOAT FLOOR' },

// ROOF COVERING
  { code: 'D4*17', description: 'Concrete tiles  Double Roman black', unit: 'no', rate: 0.95, section: 'ROOF COVERING' },
//  { code: 'F66', description: 'Roll top ridges ', unit: 'no', rate: 1.50, section: 'ROOF COVERING' },
  // { code: 'G66', description: 'Roofing sheets (0.50mm gauge)', unit: 'm2', rate: 10.0, section: 'ROOF COVERING' },
  // { code: 'H66', description: 'Roofing sheets (0.60mm gauge)', unit: 'm2', rate: 11.0, section: 'ROOF COVERING' },

  // STRUCTURAL ROOF TRUSSES
  { code: 'D4*0.082304527', description: '228*38mm*6m', unit: 'length', rate: 19.00, section: 'STRUCTURAL ROOF TRUSSES' },
  { code: 'D4*1.111111111', description: '38*38mm*6m', unit: 'length', rate: 6.00, section: 'STRUCTURAL ROOF TRUSSES' },
  { code: 'D4*0.263374486', description: '152*38mm *6m beams', unit: 'length', rate: 14.0, section: 'STRUCTURAL ROOF TRUSSES' },
  { code: 'D4*1.04526749', description: '114*38mm*6m beams', unit: 'length', rate: 12.00, section: 'STRUCTURAL ROOF TRUSSES' },
  { code: 'A4/3', description: 'A.C Fascia Board', unit: 'NO', rate: 16.50, section: 'STRUCTURAL ROOF TRUSSES' },
  // { code: 'D4*1.111111111', description: 'DPC 9 inch ', unit: 'length', rate: 6.0, section: 'STRUCTURAL ROOF TRUSSES' },
  // { code: 'D4*0.263374486', description: 'Valley gutters   2.4m', unit: 'length', rate: 14.0, section: 'STRUCTURAL ROOF TRUSSES' },

  // LABOUR — SUB-STRUCTURE (LABOUR block A61..G61)
 { code: 'H6', description: 'Site clearance', unit: 'm2', rate: 0.20, section: 'LABOUR — SUB-STRUCTURE' },
  { code: 'D4', description: 'Setting out', unit: 'm2', rate: 0.70, section: 'LABOUR — SUB-STRUCTURE' },
  { code: 'J6', description: 'Excavation to pickable earth (≤ 2m depth)', unit: 'm', rate: 4.50, section: 'LABOUR — SUB-STRUCTURE' },
  { code: 'K6', description: 'Concrete works (footings and surface beds)', unit: 'm3', rate: 20.00, section: 'LABOUR — SUB-STRUCTURE' },
  { code: 'L6', description: 'Footing brickwork in foundation', unit: 'm2', rate: 4.50, section: 'LABOUR — SUB-STRUCTURE' },
  { code: 'M6', description: 'Ramming and backfilling', unit: 'm3', rate: 4.00, section: 'LABOUR — SUB-STRUCTURE' },
  { code: 'N6', description: 'Floor slab (100mm, 1:2:4)', unit: 'm3', rate: 20.00, section: 'LABOUR — SUB-STRUCTURE' },

  // SUPER STRUCTURE TO RING BEAM
  { code: 'H12-80', description: 'Brickwork', unit: 'm2', rate: 4.50, section: 'SUPER STRUCTURE TO RING BEAM' },
  { code: 'D54+C54', description: 'Door Frame Fittings', unit: 'no', rate: 5.50, section: 'SUPER STRUCTURE TO RING BEAM' },

  // ABOVE RING BEAM
  { code: 'L12-50', description: 'Brickwork', unit: 'm2', rate: 4.50, section: 'ABOVE RING BEAM' },
  { code: 'K12', description: 'Shuttering', unit: 'm2', rate: 25.00, section: 'ABOVE RING BEAM' },
  { code: 'L12-500', description: 'Steel fixing', unit: 'kgs', rate: 3.00, section: 'ABOVE RING BEAM' },
  { code: 'J12', description: 'Ring beam and column concrete mixing', unit: 'm3', rate: 15, section: 'ABOVE RING BEAM' },
  { code: 'H15', description: 'Beam filing', unit: 'm2', rate: 12.50, section: 'ABOVE RING BEAM' },

  //BEAM FILLING
  { code: 'H15', description: 'Brickwork above the wallplate laid in stretcher bond PC cement, laid in 1:4 cement mortar and make good.', unit: 'm2', rate: 12.50, section: 'BEAM FILLING' },

  // SCREED
  { code: 'D4+40', description: '40mm screed to receive floor finishes', unit: 'bags', rate: 12.5, section: 'SCREED' },

  //TUBING AND CHOPPING
//  { code: 'C29', description: 'Supply, install and commission of conduit fittings required and all necessary accessories and fittings to complete the work as specified.', unit: 'item', rate: 650.0, section: 'TUBING AND CHOPPING' },

// ROOFING
  { code: 'D4/1.7', description: 'Roof truss', unit: 'no', rate: 12.50, section: 'ROOFING' },
  {code: 'A4/3*3.6', description: 'Facia board', unit: 'm', rate: 1.50, section: 'ROOFING'},
  { code: 'D4*1.5', description: 'Roof Coverings', unit: 'm2', rate: 4.50, section: 'ROOFING' },
  //{ code: 'D4*1.5', description: 'Extra over roll top ridges', unit: 'no', rate: 1.00, section: 'ROOFING' },


];

