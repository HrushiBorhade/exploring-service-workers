import { useEffect, useState } from "react";
import axios from "axios";
import { X, Upload, File as FileIcon, Maximize2, RotateCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { ThemeProvider } from "@/components/theme-provider";
import { ModeToggle } from "./components/theme-toggle";
// Interface for file information
interface FileInfo {
  file: File;
  previewUrl: string;
  id: string;
  name: string;
  size: number;
  type: string;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  url?: string;
  errorMessage?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  else return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

const API_URL = "http://localhost:8080";

function App() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [fileError, setFileError] = useState<string>("");
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [selectedPreview, setSelectedPreview] = useState<FileInfo | null>(null);

  const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
  const ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "video/mp4",
    "video/quicktime",
  ];

  const uploadFile = async (fileInfo: FileInfo) => {
    try {
      // Update file status to uploading
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileInfo.id ? { ...f, status: "uploading", progress: 0 } : f
        )
      );

      // Step 1: Get presigned URL
      const response = await fetch(`${API_URL}/get-upload-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: fileInfo.name,
          filetype: fileInfo.type,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get upload URL: ${response.statusText}`);
      }

      const presignedUrl = await response.json();

      // Step 2: Upload to S3 using axios with onUploadProgress
      await axios.put(presignedUrl.url, fileInfo.file, {
        headers: {
          "Content-Type": fileInfo.type,
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) /
              (progressEvent.total || fileInfo.size)
          );
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileInfo.id ? { ...f, progress: percentCompleted } : f
            )
          );
        },
      });

      // Update status on successful upload
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileInfo.id
            ? {
                ...f,
                status: "success",
                progress: 100,
                url: `https://${presignedUrl.bucket}.s3.amazonaws.com/${presignedUrl.key}`,
              }
            : f
        )
      );
    } catch (error) {
      console.error(`Error uploading ${fileInfo.name}:`, error);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileInfo.id
            ? {
                ...f,
                status: "error",
                progress: 0,
                errorMessage:
                  error instanceof Error
                    ? error.message
                    : "Failed to upload file",
              }
            : f
        )
      );
    }
  };

  const validateAndAddFiles = (selectedFiles: File[]) => {
    setFileError("");
    if (selectedFiles.length > 0) {
      const newFiles: FileInfo[] = [];
      const invalidFiles: string[] = [];

      Array.from(selectedFiles).forEach((selectedFile) => {
        // Validate file type
        if (!ALLOWED_TYPES.includes(selectedFile.type)) {
          invalidFiles.push(`${selectedFile.name} (unsupported type)`);
          return;
        }

        // Validate file size
        if (selectedFile.size > MAX_FILE_SIZE) {
          invalidFiles.push(`${selectedFile.name} (exceeds 15MB limit)`);
          return;
        }

        // Create preview URL immediately
        const previewUrl = URL.createObjectURL(selectedFile);

        // Create file info object with preview URL
        newFiles.push({
          file: selectedFile,
          previewUrl: previewUrl,
          id: crypto.randomUUID(),
          name: selectedFile.name,
          size: selectedFile.size,
          type: selectedFile.type,
          status: "pending",
          progress: 0,
        });
      });

      if (invalidFiles.length > 0) {
        setFileError(`Some files were not added: ${invalidFiles.join(", ")}`);
      }

      // Add files to state
      setFiles((prev) => [...prev, ...newFiles]);

      // Auto upload new files
      newFiles.forEach((fileInfo) => {
        uploadFile(fileInfo);
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(Array.from(e.target.files));
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(Array.from(e.dataTransfer.files));
    }
  };

  const removeFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the preview when removing
    setFiles((prev) => {
      const fileToRemove = prev.find((f) => f.id === id);
      if (fileToRemove?.previewUrl) {
        URL.revokeObjectURL(fileToRemove.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  const retryUpload = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the preview
    const fileToRetry = files.find((f) => f.id === id);
    if (fileToRetry) {
      uploadFile(fileToRetry);
    }
  };

  const openPreviewModal = (fileInfo: FileInfo) => {
    setSelectedPreview({ ...fileInfo }); // Clone the fileInfo object to ensure we have the latest data
  };

  const closePreviewModal = () => {
    setSelectedPreview(null);
  };

  // Clean up preview URLs when component unmounts
  useEffect(() => {
    return () => {
      files.forEach((fileInfo) => {
        if (fileInfo.previewUrl) {
          URL.revokeObjectURL(fileInfo.previewUrl);
        }
      });
    };
  }, []);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="font-inter w-full min-h-screen flex items-center justify-start flex-col gap-5 p-4">
        <div className="absolute right-5 top-5">
          <ModeToggle />
        </div>
        <h1 className="font-bold text-4xl underline underline-offset-4 decoration-amber-400">
          File Uploader
        </h1>
        <div className="grid w-full max-w-md items-center gap-3">
          <div className="grid w-full gap-1.5">
            <div
              className={`relative border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors min-h-40
                ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-accent hover:border-primary/50 hover:bg-accent/5"
                }`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => document.getElementById("file")?.click()}
            >
              <input
                onChange={handleFileChange}
                id="file"
                name="file"
                type="file"
                multiple
                accept="image/png,image/jpeg,image/gif,video/mp4,video/quicktime"
                className="sr-only"
              />

              <Upload size={20} className="text-muted-foreground mb-2" />
              <p className="text-base font-medium mb-1">
                Drag & Drop files here
              </p>
              <p className="text-sm text-muted-foreground mb-2">
                or click to browse
              </p>
              <p className="text-xs text-muted-foreground text-center">
                Supports: JPEG, PNG, GIF, MP4 (Max 15MB)
              </p>
            </div>

            {fileError && (
              <p className="text-sm text-red-500 mt-1">{fileError}</p>
            )}
          </div>
        </div>

        {files.length > 0 && (
          <div className="border border-accent rounded-md max-w-md w-full p-4">
            <h2 className="font-semibold mb-2">
              Selected Files ({files.length})
            </h2>
            <div className="space-y-3">
              {files.map((fileInfo) => (
                <div
                  key={fileInfo.id}
                  className={`flex border border-accent/50 rounded p-2 relative
                    ${
                      (fileInfo.type.startsWith("image/") ||
                        fileInfo.type.startsWith("video/")) &&
                      fileInfo.status !== "uploading"
                        ? "cursor-pointer hover:bg-accent/5"
                        : ""
                    }`}
                  onClick={() =>
                    (fileInfo.type.startsWith("image/") ||
                      fileInfo.type.startsWith("video/")) &&
                    fileInfo.status !== "uploading"
                      ? openPreviewModal(fileInfo)
                      : null
                  }
                >
                  <button
                    onClick={(e) => removeFile(fileInfo.id, e)}
                    className="absolute right-2 top-2 bg-background/80 rounded-full p-1 hover:bg-accent z-10"
                    aria-label="Remove file"
                  >
                    <X size={16} />
                  </button>

                  <div className="w-24 h-24 flex items-center justify-center mr-3 flex-shrink-0 bg-accent/10 rounded relative group">
                    {fileInfo.type.startsWith("image/") ? (
                      <>
                        <img
                          src={fileInfo.previewUrl}
                          alt={fileInfo.name}
                          className="max-w-full max-h-full object-contain rounded"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded">
                          <Maximize2 size={20} className="text-white" />
                        </div>
                      </>
                    ) : fileInfo.type.startsWith("video/") ? (
                      <>
                        <video
                          src={fileInfo.previewUrl}
                          className="max-w-full max-h-full object-contain rounded"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded">
                          <Maximize2 size={20} className="text-white" />
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileIcon size={32} className="text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      className="font-medium text-sm truncate"
                      title={fileInfo.name}
                    >
                      {fileInfo.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(fileInfo.size)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fileInfo.type.split("/")[1].toUpperCase()}
                    </p>

                    {/* Upload status section */}
                    <div className="mt-1">
                      {fileInfo.status === "uploading" && (
                        <div className="w-full bg-accent/30 rounded-full h-2 mt-1">
                          <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${fileInfo.progress}%` }}
                          ></div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Uploading: {fileInfo.progress}%
                          </p>
                        </div>
                      )}

                      {fileInfo.status === "success" && (
                        <p className="text-xs text-green-500 font-medium">
                          Upload complete
                        </p>
                      )}

                      {fileInfo.status === "error" && (
                        <div>
                          <p className="text-xs text-red-500 font-medium">
                            Upload failed: {fileInfo.errorMessage}
                          </p>
                          <button
                            onClick={(e) => retryUpload(fileInfo.id, e)}
                            className="text-xs text-primary flex items-center gap-1 mt-1"
                          >
                            <RotateCw size={12} />
                            Retry upload
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preview Dialog Modal */}
        <Dialog
          open={selectedPreview !== null}
          onOpenChange={(open) => !open && closePreviewModal()}
        >
          <DialogContent className="sm:max-w-3xl md:max-w-4xl max-h-screen overflow-hidden p-1 sm:p-2">
            <DialogClose className="absolute right-2 top-2 border rounded-sm p-1 bg-background/80 z-10 hover:bg-background">
              <X className="h-4 w-4" />
            </DialogClose>

            <div className="w-full h-full flex flex-col">
              <DialogTitle className="px-3 py-2 text-base font-medium truncate">
                {selectedPreview?.name}
              </DialogTitle>

              <div className="flex-1 flex items-center justify-center p-2 w-full bg-black/5 rounded-md">
                {selectedPreview?.type.startsWith("image/") ? (
                  <img
                    src={selectedPreview?.previewUrl}
                    alt={selectedPreview?.name}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : selectedPreview?.type.startsWith("video/") ? (
                  <video
                    src={selectedPreview?.previewUrl}
                    controls
                    autoPlay
                    className="max-w-full max-h-full"
                  />
                ) : null}
              </div>

              <div className="px-3 py-2 text-xs text-muted-foreground">
                {selectedPreview
                  ? `${formatFileSize(
                      selectedPreview.size
                    )} · ${selectedPreview.type.split("/")[1].toUpperCase()}`
                  : ""}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ThemeProvider>
  );
}

export default App;