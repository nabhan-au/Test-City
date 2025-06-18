package org.example;

import org.pitest.coverage.BlockLocation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.nio.file.Files;
import java.util.Arrays;
import java.util.List;

import static com.fasterxml.jackson.databind.type.LogicalType.Map;

@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/api/block")
public class BlockExtractorController {

    private static final Logger logger = LoggerFactory.getLogger(BlockExtractorController.class);

    @PostMapping("/upload/{projectName}")
    public ResponseEntity uploadAndProcess(@PathVariable("projectName") String projectName, @RequestParam("files") MultipartFile[] files) {
        File tempDir = null;
        try {
            // Create temp dir
            tempDir = Files.createTempDirectory(projectName + "-uploaded-classes").toFile();

            // Save files
            for (MultipartFile file : files) {
                File dest = new File(tempDir, file.getOriginalFilename());
                dest.getParentFile().mkdirs();
                file.transferTo(dest);
            }

            // Process
            BlockExtractor extractor = new BlockExtractor(tempDir);
            var result = extractor.process();
            var response = result.stream()
                    .flatMap(blockMap -> blockMap.entrySet().stream()
                            .map(entry -> new BlockLocationDTO(entry.getKey(), entry.getValue()))
                    ).toList();
            return ResponseEntity.ok(new CommonResponse<>(true, "Extract block successfully", response));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(new CommonResponse<>(false, e.getMessage(), null));
        } finally {
            // Optional: clean up temp files (async is safer)
             deleteDirectoryRecursively(tempDir);
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