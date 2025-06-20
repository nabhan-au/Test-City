package org.example;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.pitest.coverage.BlockLocation;

import java.util.Set;

public class BlockLocationDTO {
    public String clazz;
    public String method;
    public String methodDesc;
    public int block;
    public Set<Integer> line;

    public BlockLocationDTO(BlockLocation blockLocation, Set<Integer> line) {
        this.clazz = blockLocation.getLocation().getClassName().toString();
        this.method = blockLocation.getLocation().getMethodName();
        this.methodDesc = blockLocation.getLocation().getMethodDesc();
        this.block = blockLocation.getBlock();
        this.line = line;
    }

    public String toJson() {
        ObjectMapper mapper = new ObjectMapper();
        try {
            return mapper.writeValueAsString(this);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to convert BlockLocationDTO to JSON", e);
        }
    }
}
