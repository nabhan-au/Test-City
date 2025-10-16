package org.example;

import org.pitest.coverage.BlockLocation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.nio.file.Files;
import java.util.AbstractMap;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import static com.fasterxml.jackson.databind.type.LogicalType.Map;

@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/api/block")
public class BlockExtractorController {

    private static final Logger logger = LoggerFactory.getLogger(BlockExtractorController.class);

    @PostMapping("/upload/{projectName}")
    public ResponseEntity<?> uploadChunk(
            @PathVariable("projectName") String projectName,
            @RequestParam("uploadId") String uploadId,
            @RequestParam("isFirst") boolean isFirst,
            @RequestParam("isLast") boolean isLast,
            @RequestParam("files") MultipartFile[] files,
            @RequestParam("isClass") boolean isClass
    ) {
        var processType = "block";
        if (isClass) {
            processType = "class";
        }

        File sessionDir = new File(System.getProperty("java.io.tmpdir"),
                projectName + "-" + processType + "-" + uploadId + "-uploaded-classes");

        try {
            if (isFirst && sessionDir.exists()) {
                deleteDirectoryRecursively(sessionDir);
                logger.info("Cleared previous upload folder for project={} uploadId={}", projectName, uploadId);
            }
            if (isFirst) {
                sessionDir.mkdirs();
            }
            long totalFiles = Files.walk(sessionDir.toPath())
                    .filter(Files::isRegularFile)
                    .count();
            logger.info("Total files available for processing: {}", totalFiles);
            logger.info("Saving file to dest={} for project={} uploadId={}", sessionDir.getAbsolutePath(), projectName, uploadId);

            // Save chunk files
            for (MultipartFile file : files) {
                File dest = new File(sessionDir, file.getOriginalFilename());
                File parentDir = dest.getParentFile();
                if (!parentDir.exists()) {
                    parentDir.mkdirs();
                }

                try (var inputStream = file.getInputStream()) {
                    Files.copy(inputStream, dest.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                }
            }

            // ✅ Process automatically if last chunk
            if (isLast) {
                logger.info("Last chunk received → starting processing {} for {} ({})", processType, projectName, uploadId);
                Object response = null;
                if (isClass) {
                    ClassNameExtractor extractor = new ClassNameExtractor(sessionDir);
                    String basePath = sessionDir.getAbsolutePath();
                    var result = extractor.extractClassMappings();
                    response = result.entrySet().stream()
                            .map(entry -> {
                                String className = entry.getKey();
                                String filePath = entry.getValue();

                                // remove sessionDir prefix if present
                                String relativePath = filePath.startsWith(basePath)
                                        ? filePath.substring(basePath.length() + 1) // +1 to remove "/"
                                        : filePath;

                                return new AbstractMap.SimpleEntry<>(
                                        className,
                                        relativePath
                                );
                            })
                            .toList();
                } else {
                    BlockExtractor extractor = new BlockExtractor(sessionDir);
                    var result = extractor.process();

                    response = result.stream()
                            .flatMap(blockMap -> blockMap.entrySet().stream()
                                    .map(entry -> new BlockLocationDTO(entry.getKey(), entry.getValue())))
                            .toList();
                }
                deleteDirectoryRecursively(sessionDir);
                return ResponseEntity.ok(new CommonResponse<>(true, "Processed successfully", response));
            }

            return ResponseEntity.ok(new CommonResponse<>(true, "Chunk uploaded successfully", null));

        } catch (Exception e) {
            logger.error("Upload failed for project={} uploadId={}: {}", projectName, uploadId, e.getMessage(), e);
            return ResponseEntity.internalServerError().body(new CommonResponse<>(false, e.getMessage(), null));
        }
    }

    // You can reuse this later if you want to delete temp files
    private void deleteDirectoryRecursively(File file) {
        if (file != null && file.exists()) {
            if (file.isDirectory()) {
                for (File child : file.listFiles()) {
                    deleteDirectoryRecursively(child);
                }
            }
            file.delete();
        }
    }
}