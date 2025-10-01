package org.example;

import org.pitest.classinfo.ClassName;
import org.pitest.classpath.*;
import org.pitest.coverage.BlockLocation;
import org.pitest.coverage.analysis.LineMapper;
import org.pitest.functional.prelude.Prelude;
import org.pitest.mutationtest.config.DefaultCodePathPredicate;
import org.pitest.mutationtest.config.DefaultDependencyPathPredicate;
import org.pitest.util.Glob;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.util.*;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.stream.Collectors;

public class BlockExtractor {

    private static final Logger logger = LoggerFactory.getLogger(BlockExtractor.class);

    private final List<File> compiledCodeDirectories;

    public BlockExtractor(File dir) {
        this.compiledCodeDirectories = new ArrayList<>(Collections.singletonList(dir));
    }

    private static void collectDirectories(File dir, List<File> result) {
        if (dir.isDirectory()) {
            result.add(dir);
            for (File file : dir.listFiles()) {
                collectDirectories(file, result);
            }
        }
    }

    private ProjectClassPaths createProjectClassPaths() {
        final ClassPath classPath = new ClassPath(this.compiledCodeDirectories);
        final Predicate<String> classPredicate = createClassPredicate();
        final Predicate<ClassPathRoot> pathPredicate = new DefaultCodePathPredicate();
        return new ProjectClassPaths(classPath, new ClassFilter(classPredicate, classPredicate),
                new PathFilter(pathPredicate, Prelude.not(new DefaultDependencyPathPredicate())));
    }

    private Function<String, String> toPredicate() {
        return a -> ClassName.fromString(a).getPackage().asJavaName() + ".*";
    }

    private Predicate<String> createClassPredicate() {
        final Collection<String> classes = new HashSet<>();
        for (final File buildOutputDirectory : this.compiledCodeDirectories) {
            if (buildOutputDirectory.exists()) {
                final DirectoryClassPathRoot dcRoot = new DirectoryClassPathRoot(buildOutputDirectory);

                classes.addAll(dcRoot.classNames().stream()
                        .map(toPredicate())
                        .collect(Collectors.toList()));
            }
        }
        return Prelude.or(classes.stream()
                .map(Glob.toGlobPredicate())
                .collect(Collectors.toList()));
    }

    public List<Map<BlockLocation, Set<Integer>>> process() {
        List<Map<BlockLocation, Set<Integer>>> result = new ArrayList<>();
        ProjectClassPaths classPaths = this.createProjectClassPaths();
        DefaultCodeSource source = new DefaultCodeSource(classPaths);
        LineMapper lineMapper = new LineMapper(source);
        for (ClassName clazz : source.getAllClassAndTestNames()) {
            result.add(lineMapper.mapLines(clazz));
        }
        return result;
    }
}