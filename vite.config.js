import rollupNodePolyFill from 'rollup-plugin-node-polyfills';

export default {
    root: './visualizer',
    server: {
      open: true
    },
    build: {
        rollupOptions: {
            plugins: [rollupNodePolyFill()]
        }
    },
    define: {
        global: 'window',
    }
  };