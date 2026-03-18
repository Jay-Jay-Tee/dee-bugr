export interface HistoryEntry {
  value: string;
  type: string;
  step: number;
  line: number;
}

export interface DisassemblyLine {
  address: string;
  instruction: string;
  sourceLine?: number;
}

export interface ObjectNode {
  id: string;
  label: string;
  children: string[];
}