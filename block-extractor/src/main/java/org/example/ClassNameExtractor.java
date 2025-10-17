package org.example;

import com.github.javaparser.JavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;

import java.io.File;
import java.io.IOException;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class ClassNameExtractor {

    private final List<File> compiledCodeFileList;

    public ClassNameExtractor(File compiledCodeDirectories) {
        var result = new ArrayList<File>();
        collectFilePath(compiledCodeDirectories, result);
        this.compiledCodeFileList = result;
    }

    private static void collectFilePath(File dir, List<File> result) {
        if (dir.isDirectory()) {
            for (File file : dir.listFiles()) {
                collectFilePath(file, result);
            }
        } else if (dir.getName().endsWith(".java")) {
            result.add(dir);
        }
    }

    public Map<String, String> extractClassMappings() {
        Map<String, String> classToFileMap = new LinkedHashMap<>();
        JavaParser parser = new JavaParser();

        for (File file : compiledCodeFileList) {
            try {
                CompilationUnit cu = parser.parse(file).getResult().orElse(null);
                if (cu == null) continue;

                String packageName = cu.getPackageDeclaration()
                        .map(pd -> pd.getNameAsString())
                        .orElse("");

                cu.findAll(ClassOrInterfaceDeclaration.class).forEach(cls -> {
                    String fqcn = packageName.isEmpty()
                            ? cls.getNameAsString()
                            : packageName + "." + cls.getNameAsString();
                    classToFileMap.put(fqcn, file.getAbsolutePath());
                });

            } catch (IOException e) {
                System.err.println("Error parsing file: " + file + " → " + e.getMessage());
            }
        }
        return classToFileMap;
    }

    public static void main(String[] args) throws Exception {
        CompilationUnit cu = new JavaParser().parse(Paths.get("src/main/java/com/example/util/MyClass.java")).getResult().get();
        String pkg = cu.getPackageDeclaration().map(pd -> pd.getNameAsString()).orElse("");
        cu.findAll(ClassOrInterfaceDeclaration.class).forEach(cls -> {
            String fqcn = pkg.isEmpty() ? cls.getNameAsString() : pkg + "." + cls.getNameAsString();
            System.out.println(fqcn);
        });
    }
}
