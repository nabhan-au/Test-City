package org.example;

import java.io.File;

//TIP To <b>Run</b> code, press <shortcut actionId="Run"/> or
// click the <icon src="AllIcons.Actions.Execute"/> icon in the gutter.
public class Main {
    public static void main(String[] args) throws Exception {
        if (args.length < 1) {
            System.err.println("Usage: java -cp <classpath> org.example.BlockExtractor <directory_path>");
            System.exit(1);
        }

        String dirPath = args[0];
        File root = new File(dirPath);

        if (!root.exists() || !root.isDirectory()) {
            System.err.println("Provided path is not a valid directory: " + dirPath);
            System.exit(1);
        }

        BlockExtractor block = new BlockExtractor(root);
        block.process();
    }
}