export type NoteImage = {
  id: string;
  note_id: string;
  storage_path: string;
  display_order: number;
  url: string;
};

export type Note = {
  id: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
  images: NoteImage[];
};

export type DraftImage =
  | { kind: "existing"; id: string; url: string; storage_path: string; display_order: number; file?: never }
  | { kind: "new"; id: string; url: string; file: File; storage_path?: never; display_order: number };
