package org.example.config;

import jakarta.servlet.MultipartConfigElement;
import org.springframework.boot.web.servlet.MultipartConfigFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.unit.DataSize;

@Configuration
public class MultipartConfig {
    @Bean
    public MultipartConfigElement multipartConfigElement() {
        MultipartConfigFactory factory = new MultipartConfigFactory();
        factory.setMaxFileSize(DataSize.ofGigabytes(1000));     // 1000 GB per file
        factory.setMaxRequestSize(DataSize.ofGigabytes(1000));  // 1000 GB total
        factory.setLocation("/tmp");                            // ensure enough disk space
        return factory.createMultipartConfig();
    }
}