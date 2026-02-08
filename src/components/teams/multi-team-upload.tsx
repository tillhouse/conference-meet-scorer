"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, CheckCircle, AlertCircle, Info } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Team {
  id: string;
  name: string;
  schoolName: string | null;
}

interface MultiTeamUploadProps {
  teams: Team[];
  onSuccess?: () => void;
}

export function MultiTeamUpload({ teams, onSuccess }: MultiTeamUploadProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    athletesAdded: number;
    eventsAdded: number;
    teamsProcessed: number;
    errors: string[];
  } | null>(null);

  const validateFile = (selectedFile: File) => {
    if (
      selectedFile.type === "text/csv" ||
      selectedFile.type === "text/plain" ||
      selectedFile.name.endsWith(".csv") ||
      selectedFile.name.endsWith(".txt")
    ) {
      setFile(selectedFile);
      setUploadResult(null);
      return true;
    } else {
      toast.error("Please select a CSV or TXT file");
      return false;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateFile(selectedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      validateFile(droppedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file first");
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/teams/upload-multi", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Upload failed");
      }

      setUploadResult(result);
      toast.success(
        `Successfully uploaded data for ${result.teamsProcessed} teams: ${result.athletesAdded} athletes with ${result.eventsAdded} event times`
      );

      // Refresh the page to show new data
      setTimeout(() => {
        router.refresh();
        onSuccess?.();
      }, 1000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload file");
      setUploadResult({
        success: false,
        athletesAdded: 0,
        eventsAdded: 0,
        teamsProcessed: 0,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Data for Multiple Teams</CardTitle>
        <CardDescription>
          Upload a CSV file with athlete data for multiple teams. Data will be saved to each team's
          database and available for all meets using those teams.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Teams Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900 mb-2">
                Available Teams ({teams.length})
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-xs text-blue-700">
                {teams.map((team) => (
                  <div key={team.id}>
                    <div className="font-medium">{team.name}</div>
                    {team.schoolName && (
                      <div className="text-blue-600">{team.schoolName}</div>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-blue-600 mt-3">
                Include a "Team" column in your CSV to automatically assign athletes to the correct
                teams. Team names will be matched to the teams listed above.
              </p>
            </div>
          </div>
        </div>

        {/* File Input */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? "border-slate-500 bg-slate-50"
              : "border-slate-300 hover:border-slate-400"
          }`}
        >
          <input
            type="file"
            accept=".csv,.txt"
            onChange={handleFileChange}
            className="hidden"
            id="multi-csv-upload"
          />
          <label
            htmlFor="multi-csv-upload"
            className="cursor-pointer flex flex-col items-center gap-4"
          >
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
                isDragging ? "bg-slate-200" : "bg-slate-100"
              }`}
            >
              <Upload className="h-6 w-6 text-slate-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">
                {file ? (
                  file.name
                ) : isDragging ? (
                  "Drop file here"
                ) : (
                  "Click to select a file or drag and drop"
                )}
              </p>
              <p className="text-xs text-slate-500 mt-1">CSV or TXT format</p>
            </div>
          </label>
        </div>

        {/* Upload Button */}
        {file && (
          <Button onClick={handleUpload} disabled={uploading} className="w-full">
            {uploading ? (
              <>
                <FileText className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </>
            )}
          </Button>
        )}

        {/* Upload Result */}
        {uploadResult && (
          <Card
            className={
              uploadResult.success
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            }
          >
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                {uploadResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                )}
                <div className="flex-1 space-y-2">
                  <p
                    className={`font-medium ${
                      uploadResult.success ? "text-green-900" : "text-red-900"
                    }`}
                  >
                    {uploadResult.success ? "Upload Successful" : "Upload Failed"}
                  </p>
                  {uploadResult.success && (
                    <div className="text-sm text-green-700 space-y-1">
                      <p>• {uploadResult.teamsProcessed} teams processed</p>
                      <p>• {uploadResult.athletesAdded} athletes added/updated</p>
                      <p>• {uploadResult.eventsAdded} event times added/updated</p>
                      <p className="text-xs text-green-600 mt-2 font-medium">
                        💡 Data saved to team databases and available for all meets using these
                        teams.
                      </p>
                    </div>
                  )}
                  {uploadResult.errors.length > 0 && (
                    <div className="text-sm text-red-700">
                      <p className="font-medium mb-1">Errors:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {uploadResult.errors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Format Help */}
        <Card className="bg-slate-50">
          <CardHeader>
            <CardTitle className="text-sm">Expected File Format</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 space-y-2">
            <p>Your CSV/TXT file should have columns for:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Name (Last, First or First Last)</li>
              <li>
                <strong>Team</strong> (required - team name will be matched to your teams)
              </li>
              <li>Event name (e.g., "500 FR", "200 IM", "1M")</li>
              <li>Time/Score (e.g., "4:15.32" or "325.50")</li>
              <li>Optional: Year (FR, SO, JR, SR, GR)</li>
              <li>Optional: Diver flag</li>
            </ul>
            <p className="text-xs text-slate-500 mt-2">
              Data is saved to each team's database and will be available for all meets using
              those teams. You can also upload from meet pages - both methods update the same team
              databases.
            </p>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
