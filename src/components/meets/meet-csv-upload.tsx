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

interface MeetCSVUploadProps {
  meetId: string;
  meetTeams: Team[];
}

export function MeetCSVUpload({ meetId, meetTeams }: MeetCSVUploadProps) {
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
      formData.append("meetId", meetId);

      const response = await fetch("/api/meets/upload", {
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
    <div className="space-y-4">
      {/* Teams Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            Teams in This Meet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {meetTeams.map((team) => (
              <div key={team.id} className="text-sm text-slate-700">
                <div className="font-medium">{team.name}</div>
                {team.schoolName && (
                  <div className="text-xs text-slate-500">{team.schoolName}</div>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-600 mt-3">
            Your CSV file should include athletes from these teams. The upload will automatically
            assign athletes to the correct team based on team name matching. Include a "Team" column
            in your CSV with team names, or upload one file per team.
          </p>
          <p className="text-xs text-blue-600 mt-2 font-medium">
            💡 Data is saved to each team's database and will be available for all meets using
            those teams. You can also upload from the "My Teams" page - both methods update the
            same team databases.
          </p>
        </CardContent>
      </Card>

      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Athlete Data</CardTitle>
          <CardDescription>
            Upload a CSV or TXT file with athlete names, events, and times for all teams in this
            meet
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
              id="csv-upload"
            />
            <label
              htmlFor="csv-upload"
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
                  <strong>Team</strong> (recommended - team name will be matched to teams in this
                  meet)
                </li>
                <li>Event name (e.g., "500 FR", "200 IM", "1M")</li>
                <li>Time/Score (e.g., "4:15.32" or "325.50")</li>
                <li>Optional: Year (FR, SO, JR, SR, GR)</li>
                <li>Optional: Diver flag</li>
              </ul>
              <p className="text-xs text-slate-500 mt-2">
                The parser will attempt to detect the format automatically. If your CSV includes a
                "Team" column, athletes will be assigned to the matching team. Data is saved to
                each team's database and will be available for all future meets using those teams.
                You can also upload from the "My Teams" page - both methods update the same team
                databases.
              </p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
