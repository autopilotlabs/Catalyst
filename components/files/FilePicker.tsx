"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchJsonWithRateLimitHandling } from "@/lib/fetch-with-handling";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileIcon, Search, Upload } from "lucide-react";

interface FileItem {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  createdAt: string;
}

interface FilePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (fileId: string) => void;
  entityType?: string;
  entityId?: string;
  title?: string;
  description?: string;
}

export function FilePicker({
  open,
  onOpenChange,
  onSelect,
  entityType,
  entityId,
  title = "Select File",
  description = "Choose a file from your workspace storage or upload a new one.",
}: FilePickerProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchFiles = async () => {
    try {
      const data = await fetchJsonWithRateLimitHandling<{ success: boolean; files: FileItem[] }>(
        "/api/files"
      );

      setFiles(data.files || []);
      setFilteredFiles(data.files || []);
    } catch (error: any) {
      toast.error("Failed to fetch files", {
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchFiles();
    }
  }, [open]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = files.filter((file) =>
        file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.mimeType.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredFiles(filtered);
    } else {
      setFilteredFiles(files);
    }
  }, [searchQuery, files]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file");
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();

      if (data.success) {
        toast.success("File uploaded successfully");
        setSelectedFile(null);
        await fetchFiles();
        
        // If entityType provided, create reference
        if (entityType && entityId && data.file.id) {
          await createFileRef(data.file.id);
        }
        
        // Select the newly uploaded file
        onSelect(data.file.id);
        onOpenChange(false);
      } else {
        throw new Error(data.message || "Upload failed");
      }
    } catch (error: any) {
      toast.error("Failed to upload file", {
        description: error.message,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const createFileRef = async (fileId: string) => {
    try {
      await fetch(`/api/files/${fileId}/refs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entityType,
          entityId,
        }),
      });
    } catch (error: any) {
      // Silent fail - reference creation is optional
      console.error("Failed to create file reference:", error);
    }
  };

  const handleSelectFile = async (fileId: string) => {
    // If entityType provided, create reference
    if (entityType && entityId) {
      await createFileRef(fileId);
    }
    
    onSelect(fileId);
    onOpenChange(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Upload Section */}
          <div className="border rounded-lg p-4 bg-muted/50">
            <h3 className="text-sm font-semibold mb-3">Upload New File</h3>
            <div className="flex space-x-2">
              <Input
                type="file"
                onChange={handleFileSelect}
                disabled={isUploading}
                className="flex-1"
              />
              <Button onClick={handleUpload} disabled={!selectedFile || isUploading}>
                <Upload className="mr-2 h-4 w-4" />
                {isUploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
            {selectedFile && (
              <p className="text-xs text-muted-foreground mt-2">
                Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
              </p>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* File List */}
          <div className="flex-1 overflow-auto border rounded-lg">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                Loading files...
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="p-8 text-center">
                <FileIcon className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  {searchQuery ? "No files found matching your search" : "No files available"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFiles.map((file) => (
                    <TableRow key={file.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <div className="flex items-center">
                          <FileIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                          {file.name}
                        </div>
                      </TableCell>
                      <TableCell>{formatFileSize(file.size)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {file.mimeType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleSelectFile(file.id)}
                        >
                          Select
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
