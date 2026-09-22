/**
 * Bootstrap database contract used by the client. CI regenerates a complete
 * schema artifact from the fully migrated local database; application-owned
 * row contracts remain narrower at each repository/query boundary.
 */
type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
type GenericTable = {
  Row: any;
  Insert: any;
  Update: any;
  Relationships: any[];
};
type GenericFunction = { Args: any; Returns: any };

export type Database = {
  public: {
    Tables: Record<string, GenericTable>;
    Views: Record<string, GenericTable>;
    Functions: Record<string, GenericFunction>;
    Enums: Record<string, string>;
    CompositeTypes: Record<string, Record<string, Json | undefined>>;
  };
};
