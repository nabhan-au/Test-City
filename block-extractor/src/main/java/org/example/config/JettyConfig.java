package org.example.config;

import org.springframework.boot.web.embedded.jetty.JettyServletWebServerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JettyConfig {

    @Bean
    public JettyServletWebServerFactory jettyFactory() {
        JettyServletWebServerFactory factory = new JettyServletWebServerFactory();
        factory.addServerCustomizers(server -> {
            // ✅ Jetty 12 attribute names:
            server.setAttribute("org.eclipse.jetty.ee10.servlet.MultipartConfig.maxFileSize", -1L);
            server.setAttribute("org.eclipse.jetty.ee10.servlet.MultipartConfig.maxRequestSize", -1L);

            // ✅ these two control form parsing limits:
            server.setAttribute("org.eclipse.jetty.server.Request.maxFormContentSize", -1); // unlimited
            server.setAttribute("org.eclipse.jetty.server.Request.maxFormKeys", 100_000); // allow 100k files
        });
        System.out.println("✅ JettyConfig loaded and applied!");

        return factory;
    }
}