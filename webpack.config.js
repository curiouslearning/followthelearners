const path = require('path');

module.exports = {
  entry: './static/js/index.ts',
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
    path: path.resolve(__dirname, 'static/js/public'),
  },
  mode: 'development',
};
