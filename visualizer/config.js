var require = {
  paths: {
    "d3": "../node_modules/d3/d3",
    "threejs": "../node_modules/three/build/three",
    "jquery": "../node_modules/jquery/dist/jquery",
  },
  shim: {
    "d3": {
      exports: "d3"
    },
    "threejs": {
      exports: "THREE"
    }
  },
  baseUrl: "../",
  urlArgs: "bust=" + (new Date()).getTime()
};