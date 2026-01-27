export interface ImageRecord {
  id: number;
  full_path: string;
  filename: string;
  file_size_bytes: number | null;
  file_modified_at: string;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  exif_camera: string | null;
  exif_date_taken: string | null;
  exif_gps_lat: number | null;
  exif_gps_lon: number | null;
  upload_file_id: string | null;
  uploaded_at: string | null;
  batch_id: string | null;
  batch_custom_id: string | null;
  processed: number;
  analysis_result: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnalysisResult {
  composition: number;
  lighting: number;
  color_and_tone: number;
  subject_storytelling: number;
  technical_execution: number;
  overall_impact: number;
  comment: string;
  caption: string;
  keywords: string[];
}
