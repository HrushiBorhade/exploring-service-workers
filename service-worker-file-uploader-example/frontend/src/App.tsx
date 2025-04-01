import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { ThemeProvider } from "@/components/theme-provider";
import { ModeToggle } from "./components/theme-toggle";
import { X, Upload, File as FileIcon, Maximize2 } from "lucide-react";

// Interface for file information
interface FileInfo {
  file: File;
  previewUrl: string;
  id: string;
  name: string;
  size: number;
  type: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  else return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (files.length === 0) {
      setFileError("Please select at least one file");
      return;
    }

    // Track upload progress or errors
    const uploadResults: {
      file: string;
      presignedUrl?: string;
      status: string;
      message?:string
    }[] = [];

    try {
      // Process files in parallel
      await Promise.all(
        files.map(async (_file) => {
          try {
            // Create proper JSON body
            const requestBody = JSON.stringify({
              filename: _file.name,
              filetype: _file.type,
            });

            const response = await fetch(
              "http://localhost:8080/get-upload-url",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: requestBody,
              }
            );

            if (!response.ok) {
              throw new Error(
                `Upload failed for ${_file.name}: ${response.statusText}`
              );
            }

            const presignedUrl = await response.json();

            uploadResults.push({
              file: _file.name,
              presignedUrl,
              status: "success",
            });
          } catch (error:unknown) {
            console.error(`Error uploading ${_file.name}:`, error);
            uploadResults.push({
              file: _file.name,
              status: "error",
              message: "Failed to get presigned url",
            });
          }
        })
      );

      console.log("Upload results:", uploadResults);

      // Here you could add state management for showing upload results to the user
    } catch (error) {
      console.error("Upload process failed:", error);
      setFileError("Upload process failed. Please try again.");
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
        });
      });

      if (invalidFiles.length > 0) {
        setFileError(`Some files were not added: ${invalidFiles.join(", ")}`);
      }

      setFiles((prev) => [...prev, ...newFiles]);
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
        <form
          onSubmit={handleSubmit}
          className="grid w-full max-w-md items-center gap-3"
        >
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

          <Button
            type="submit"
            disabled={files.length === 0}
            className="w-full disabled:cursor-not-allowed"
          >
            Upload {files.length > 0 ? `(${files.length} files)` : ""}
          </Button>
        </form>

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
                      fileInfo.type.startsWith("image/") ||
                      fileInfo.type.startsWith("video/")
                        ? "cursor-pointer hover:bg-accent/5"
                        : ""
                    }`}
                  onClick={() =>
                    fileInfo.type.startsWith("image/") ||
                    fileInfo.type.startsWith("video/")
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

/******************** transition and animation - kinda apple like *******************************/

// import { useEffect, useState } from "react";
// import {
//   Dialog,
//   DialogContent,
//   DialogTitle,
//   DialogClose,
// } from "@/components/ui/dialog";
// import { ThemeProvider } from "@/components/theme-provider";
// import { ModeToggle } from "./components/theme-toggle";
// import { X, Upload, File as FileIcon, Maximize2 } from "lucide-react";
// import { motion, AnimatePresence } from "framer-motion";

// // Interface for file information
// interface FileInfo {
//   file: File;
//   previewUrl: string;
//   id: string;
//   name: string;
//   size: number;
//   type: string;
// }

// function formatFileSize(bytes: number): string {
//   if (bytes < 1024) return bytes + " B";
//   else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
//   else return (bytes / (1024 * 1024)).toFixed(1) + " MB";
// }

// function App() {
//   const [files, setFiles] = useState<FileInfo[]>([]);
//   const [fileError, setFileError] = useState<string>("");
//   const [isDragging, setIsDragging] = useState<boolean>(false);
//   const [selectedPreview, setSelectedPreview] = useState<FileInfo | null>(null);
//   const [isUploading, setIsUploading] = useState<boolean>(false);

//   const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
//   const ALLOWED_TYPES = [
//     "image/jpeg",
//     "image/png",
//     "image/gif",
//     "video/mp4",
//     "video/quicktime",
//   ];

//   const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     if (files.length === 0) {
//       setFileError("Please select at least one file");
//       return;
//     }

//     // Simulate upload
//     setIsUploading(true);
//     setTimeout(() => {
//       console.log(
//         "Uploading files:",
//         files.map((f) => f.name)
//       );
//       setIsUploading(false);
//       // Optional: Clear files after successful upload
//       // setFiles([]);
//     }, 2000);
//   };

//   const validateAndAddFiles = (selectedFiles: File[]) => {
//     setFileError("");
//     if (selectedFiles.length > 0) {
//       const newFiles: FileInfo[] = [];
//       const invalidFiles: string[] = [];

//       Array.from(selectedFiles).forEach((selectedFile) => {
//         // Validate file type
//         if (!ALLOWED_TYPES.includes(selectedFile.type)) {
//           invalidFiles.push(`${selectedFile.name} (unsupported type)`);
//           return;
//         }

//         // Validate file size
//         if (selectedFile.size > MAX_FILE_SIZE) {
//           invalidFiles.push(`${selectedFile.name} (exceeds 15MB limit)`);
//           return;
//         }

//         // Create preview URL immediately when adding the file
//         const previewUrl = URL.createObjectURL(selectedFile);

//         // Create file info object with previewUrl already set
//         newFiles.push({
//           file: selectedFile,
//           previewUrl: previewUrl,
//           id: crypto.randomUUID(),
//           name: selectedFile.name,
//           size: selectedFile.size,
//           type: selectedFile.type,
//         });
//       });

//       if (invalidFiles.length > 0) {
//         setFileError(`Some files were not added: ${invalidFiles.join(", ")}`);
//       }

//       // Add new files to the existing files array
//       setFiles((prev) => [...prev, ...newFiles]);
//     }
//   };

//   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     if (e.target.files && e.target.files.length > 0) {
//       validateAndAddFiles(Array.from(e.target.files));
//     }
//   };

//   const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
//     e.preventDefault();
//     e.stopPropagation();
//     setIsDragging(true);
//   };

//   const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
//     e.preventDefault();
//     e.stopPropagation();
//     setIsDragging(false);
//   };

//   const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
//     e.preventDefault();
//     e.stopPropagation();
//   };

//   const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
//     e.preventDefault();
//     e.stopPropagation();
//     setIsDragging(false);

//     if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
//       validateAndAddFiles(Array.from(e.dataTransfer.files));
//     }
//   };

//   const removeFile = (id: string, e: React.MouseEvent) => {
//     e.stopPropagation(); // Prevent opening the preview when removing
//     setFiles((prev) => {
//       const fileToRemove = prev.find((f) => f.id === id);

//       // If the file being removed is currently being previewed, close the preview
//       if (selectedPreview && selectedPreview.id === id) {
//         setSelectedPreview(null);
//       }

//       // Revoke the URL before removing the file
//       if (fileToRemove?.previewUrl) {
//         URL.revokeObjectURL(fileToRemove.previewUrl);
//       }

//       return prev.filter((f) => f.id !== id);
//     });
//   };

//   const openPreviewModal = (fileInfo: FileInfo) => {
//     // Make a deep copy of the file info to ensure it doesn't reference
//     // the same object that might be modified later
//     setSelectedPreview({...fileInfo});
//   };

//   const closePreviewModal = () => {
//     setSelectedPreview(null);
//   };

//   // Clean up object URLs on unmount
//   useEffect(() => {
//     return () => {
//       files.forEach((fileInfo) => {
//         if (fileInfo.previewUrl) {
//           URL.revokeObjectURL(fileInfo.previewUrl);
//         }
//       });
//     };
//   }, []);

//   // Animation variants
//   const dropzoneVariants = {
//     idle: {
//       scale: 1,
//       opacity: 1,
//       boxShadow: "0 0 0 rgba(0, 0, 0, 0)",
//     },
//     dragging: {
//       scale: 1.02,
//       opacity: 1,
//       boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
//     },
//   };

//   const fileItemVariants = {
//     hidden: { opacity: 0, y: 20, scale: 0.95 },
//     visible: (i: number) => ({
//       opacity: 1,
//       y: 0,
//       scale: 1,
//       transition: {
//         delay: i * 0.05,
//         duration: 0.4,
//         ease: [0.23, 1, 0.32, 1], // Custom easing curve for Apple-like spring
//       },
//     }),
//     exit: {
//       opacity: 0,
//       scale: 0.9,
//       x: -10,
//       transition: { duration: 0.3, ease: [0.23, 1, 0.32, 1] },
//     },
//   };

//   const uploadButtonVariants = {
//     idle: { scale: 1 },
//     hover: { scale: 1.03 },
//     tap: { scale: 0.97 },
//   };

//   return (
//     <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
//       <div className="font-inter w-full min-h-screen flex items-center justify-start flex-col gap-5 p-4">
//         <motion.div
//           initial={{ opacity: 0, y: -10 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
//           className="absolute right-5 top-5"
//         >
//           <ModeToggle />
//         </motion.div>

//         <motion.h1
//           initial={{ opacity: 0, y: -20 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ duration: 0.6, delay: 0.1, ease: [0.23, 1, 0.32, 1] }}
//           className="font-bold text-4xl underline underline-offset-4 decoration-amber-400"
//         >
//           File Uploader
//         </motion.h1>

//         <form
//           onSubmit={handleSubmit}
//           className="grid w-full max-w-md items-center gap-3"
//         >
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{ duration: 0.6, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
//             className="grid w-full gap-1.5"
//           >
//             <motion.div
//               variants={dropzoneVariants}
//               initial="idle"
//               animate={isDragging ? "dragging" : "idle"}
//               transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
//               className={`relative border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer min-h-40
//                 ${
//                   isDragging
//                     ? "border-primary bg-primary/5"
//                     : "border-accent hover:border-primary/50 hover:bg-accent/5"
//                 }`}
//               onDragEnter={handleDragEnter}
//               onDragLeave={handleDragLeave}
//               onDragOver={handleDragOver}
//               onDrop={handleDrop}
//               onClick={() => document.getElementById("file")?.click()}
//             >
//               <input
//                 onChange={handleFileChange}
//                 id="file"
//                 name="file"
//                 type="file"
//                 multiple
//                 accept="image/png,image/jpeg,image/gif,video/mp4,video/quicktime"
//                 className="sr-only"
//               />

//               <motion.div
//                 initial={{ scale: 0.8, opacity: 0 }}
//                 animate={{ scale: 1, opacity: 1 }}
//                 transition={{ delay: 0.3, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
//               >
//                 <Upload size={20} className="text-muted-foreground mb-2" />
//               </motion.div>

//               <motion.p
//                 initial={{ y: 10, opacity: 0 }}
//                 animate={{ y: 0, opacity: 1 }}
//                 transition={{ delay: 0.4, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
//                 className="text-base font-medium mb-1"
//               >
//                 Drag & Drop files here
//               </motion.p>

//               <motion.p
//                 initial={{ y: 10, opacity: 0 }}
//                 animate={{ y: 0, opacity: 1 }}
//                 transition={{ delay: 0.45, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
//                 className="text-sm text-muted-foreground mb-2"
//               >
//                 or click to browse
//               </motion.p>

//               <motion.p
//                 initial={{ y: 10, opacity: 0 }}
//                 animate={{ y: 0, opacity: 1 }}
//                 transition={{ delay: 0.5, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
//                 className="text-xs text-muted-foreground text-center"
//               >
//                 Supports: JPEG, PNG, GIF, MP4 (Max 15MB)
//               </motion.p>
//             </motion.div>

//             <AnimatePresence>
//               {fileError && (
//                 <motion.p
//                   initial={{ opacity: 0, height: 0 }}
//                   animate={{ opacity: 1, height: "auto" }}
//                   exit={{ opacity: 0, height: 0 }}
//                   transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
//                   className="text-sm text-red-500 mt-1"
//                 >
//                   {fileError}
//                 </motion.p>
//               )}
//             </AnimatePresence>
//           </motion.div>

//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{ duration: 0.6, delay: 0.3, ease: [0.23, 1, 0.32, 1] }}
//           >
//             <motion.button
//               variants={uploadButtonVariants}
//               initial="idle"
//               whileHover="hover"
//               whileTap="tap"
//               transition={{ duration: 0.2 }}
//               disabled={files.length === 0 || isUploading}
//               type="submit"
//               className="w-full bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
//             >
//               {isUploading ? (
//                 <span className="flex items-center justify-center">
//                   <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
//                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
//                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
//                   </svg>
//                   Uploading...
//                 </span>
//               ) : (
//                 `Upload ${files.length > 0 ? `(${files.length} files)` : ""}`
//               )}
//             </motion.button>
//           </motion.div>
//         </form>

//         <AnimatePresence>
//           {files.length > 0 && (
//             <motion.div
//               initial={{ opacity: 0, y: 20, height: 0 }}
//               animate={{ opacity: 1, y: 0, height: "auto" }}
//               exit={{ opacity: 0, y: -10, height: 0 }}
//               transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
//               className="border border-accent rounded-md max-w-md w-full p-4 overflow-hidden"
//             >
//               <motion.h2
//                 initial={{ opacity: 0 }}
//                 animate={{ opacity: 1 }}
//                 transition={{ duration: 0.3, delay: 0.1 }}
//                 className="font-semibold mb-2"
//               >
//                 Selected Files ({files.length})
//               </motion.h2>

//               <div className="space-y-3">
//                 <AnimatePresence>
//                   {files.map((fileInfo, index) => (
//                     <motion.div
//                       key={fileInfo.id}
//                       custom={index}
//                       variants={fileItemVariants}
//                       initial="hidden"
//                       animate="visible"
//                       exit="exit"
//                       layout
//                       className={`flex border border-accent/50 rounded-lg p-2 relative overflow-hidden
//                         ${
//                           fileInfo.type.startsWith("image/") ||
//                           fileInfo.type.startsWith("video/")
//                             ? "cursor-pointer hover:bg-accent/5 hover:shadow-sm"
//                             : ""
//                         } transition-all duration-300 ease-out`}
//                       onClick={() =>
//                         fileInfo.type.startsWith("image/") ||
//                         fileInfo.type.startsWith("video/")
//                           ? openPreviewModal(fileInfo)
//                           : null
//                       }
//                     >
//                       <motion.button
//                         initial={{ opacity: 0, scale: 0.8 }}
//                         animate={{ opacity: 1, scale: 1 }}
//                         whileHover={{ scale: 1.1, backgroundColor: "rgba(255, 50, 50, 0.1)" }}
//                         transition={{ duration: 0.2 }}
//                         onClick={(e) => removeFile(fileInfo.id, e)}
//                         className="absolute right-2 top-2 bg-background/80 rounded-full p-1 hover:bg-accent z-10 backdrop-blur-sm"
//                         aria-label="Remove file"
//                       >
//                         <X size={16} />
//                       </motion.button>

//                       <motion.div
//                         initial={{ opacity: 0 }}
//                         animate={{ opacity: 1 }}
//                         transition={{ duration: 0.5, delay: 0.2 + index * 0.05 }}
//                         className="w-24 h-24 flex items-center justify-center mr-3 flex-shrink-0 bg-accent/10 rounded relative group overflow-hidden"
//                       >
//                         {fileInfo.type.startsWith("image/") ? (
//                           <>
//                             <motion.img
//                               initial={{ scale: 1.2, opacity: 0 }}
//                               animate={{ scale: 1, opacity: 1 }}
//                               transition={{ duration: 0.5 }}
//                               src={fileInfo.previewUrl}
//                               alt={fileInfo.name}
//                               className="max-w-full max-h-full object-contain rounded"
//                             />
//                             <motion.div
//                               initial={{ opacity: 0 }}
//                               whileHover={{ opacity: 1 }}
//                               transition={{ duration: 0.2 }}
//                               className="absolute inset-0 bg-black/20 flex items-center justify-center rounded backdrop-blur-sm"
//                             >
//                               <Maximize2 size={20} className="text-white drop-shadow-md" />
//                             </motion.div>
//                           </>
//                         ) : fileInfo.type.startsWith("video/") ? (
//                           <>
//                             <motion.video
//                               initial={{ scale: 1.1, opacity: 0 }}
//                               animate={{ scale: 1, opacity: 1 }}
//                               transition={{ duration: 0.5 }}
//                               src={fileInfo.previewUrl}
//                               className="max-w-full max-h-full object-contain rounded"
//                             />
//                             <motion.div
//                               initial={{ opacity: 0 }}
//                               whileHover={{ opacity: 1 }}
//                               transition={{ duration: 0.2 }}
//                               className="absolute inset-0 bg-black/20 flex items-center justify-center rounded backdrop-blur-sm"
//                             >
//                               <Maximize2 size={20} className="text-white drop-shadow-md" />
//                             </motion.div>
//                           </>
//                         ) : (
//                           <motion.div
//                             initial={{ scale: 0.8, opacity: 0 }}
//                             animate={{ scale: 1, opacity: 1 }}
//                             transition={{ duration: 0.4 }}
//                             className="w-full h-full flex items-center justify-center"
//                           >
//                             <FileIcon size={32} className="text-muted-foreground" />
//                           </motion.div>
//                         )}
//                       </motion.div>

//                       <motion.div
//                         initial={{ x: 20, opacity: 0 }}
//                         animate={{ x: 0, opacity: 1 }}
//                         transition={{ duration: 0.4, delay: 0.3 + index * 0.05 }}
//                         className="flex-1 min-w-0"
//                       >
//                         <p
//                           className="font-medium text-sm truncate"
//                           title={fileInfo.name}
//                         >
//                           {fileInfo.name}
//                         </p>
//                         <p className="text-xs text-muted-foreground">
//                           {formatFileSize(fileInfo.size)}
//                         </p>
//                         <p className="text-xs text-muted-foreground">
//                           {fileInfo.type.split("/")[1].toUpperCase()}
//                         </p>
//                       </motion.div>
//                     </motion.div>
//                   ))}
//                 </AnimatePresence>
//               </div>
//             </motion.div>
//           )}
//         </AnimatePresence>

//         {/* Preview Dialog Modal */}
//         <AnimatePresence>
//           {selectedPreview && (
//             <Dialog
//               open={selectedPreview !== null}
//               onOpenChange={(open) => !open && closePreviewModal()}
//             >
//               <DialogContent className="sm:max-w-3xl md:max-w-4xl max-h-screen overflow-hidden p-1 sm:p-2 backdrop-blur-xl bg-background/90">
//                 <motion.div
//                   initial={{ opacity: 0, scale: 0.95 }}
//                   animate={{ opacity: 1, scale: 1 }}
//                   exit={{ opacity: 0, scale: 0.95 }}
//                   transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
//                   className="w-full h-full flex flex-col"
//                 >
//                   <DialogClose className="absolute right-2 top-2 border rounded-sm p-1 bg-background/80 z-10 hover:bg-background backdrop-blur-sm transition-all duration-300">
//                     <X className="h-4 w-4" />
//                   </DialogClose>

//                   <DialogTitle className="px-3 py-2 text-base font-medium truncate">
//                     {selectedPreview?.name}
//                   </DialogTitle>

//                   <motion.div
//                     initial={{ opacity: 0 }}
//                     animate={{ opacity: 1 }}
//                     transition={{ duration: 0.5, delay: 0.2 }}
//                     className="flex-1 flex items-center justify-center p-2 w-full bg-black/5 rounded-md overflow-hidden"
//                   >
//                     {selectedPreview?.type.startsWith("image/") ? (
//                       <motion.img
//                         initial={{ scale: 1.05, opacity: 0 }}
//                         animate={{ scale: 1, opacity: 1 }}
//                         transition={{ duration: 0.5 }}
//                         src={selectedPreview?.previewUrl}
//                         alt={selectedPreview?.name}
//                         className="max-w-full max-h-full object-contain"
//                       />
//                     ) : selectedPreview?.type.startsWith("video/") ? (
//                       <motion.video
//                         initial={{ scale: 1.05, opacity: 0 }}
//                         animate={{ scale: 1, opacity: 1 }}
//                         transition={{ duration: 0.5 }}
//                         src={selectedPreview?.previewUrl}
//                         controls
//                         autoPlay
//                         className="max-w-full max-h-full"
//                       />
//                     ) : null}
//                   </motion.div>

//                   <motion.div
//                     initial={{ opacity: 0, y: 10 }}
//                     animate={{ opacity: 1, y: 0 }}
//                     transition={{ duration: 0.3, delay: 0.3 }}
//                     className="px-3 py-2 text-xs text-muted-foreground"
//                   >
//                     {selectedPreview
//                       ? `${formatFileSize(
//                           selectedPreview.size
//                         )} · ${selectedPreview.type.split("/")[1].toUpperCase()}`
//                       : ""}
//                   </motion.div>
//                 </motion.div>
//               </DialogContent>
//             </Dialog>
//           )}
//         </AnimatePresence>
//       </div>
//     </ThemeProvider>
//   );
// }

// export default App;
