// config.js
const config = {
  dev: {
    port: 3000,
    hotJarScriptPath: '/static/js/third/hj-dev.js',
  },
  prod: {
    port: 3000,
    hotJarScriptPath: '/static/js/third/hj.js',
  },
};

module.exports = config;
