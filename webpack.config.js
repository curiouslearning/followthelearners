const path = require('path');

module.exports = {
  entry: {
    index: './static/js/index.ts',
    admin: './static/js/admin/admin.ts',
    dashboard: './static/js/admin/dashboard.ts',
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        include: [path.resolve(__dirname, 'static/js')],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },
  output: {
    filename: 'bundle.js',
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'static/js/public'),
  },
  mode: 'development',
};
