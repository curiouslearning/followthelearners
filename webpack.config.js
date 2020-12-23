const path = require('path');
const JSObfuscator = require('webpack-obfuscator');


module.exports = {
  entry: './static/js/index.ts',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        include: [path.resolve(__dirname, 'static/js')],
        // exclude: /node_modules/,
        // enforce: 'post',
        // use: {
        //   loader: JSObfuscator.loader,
        //   options: {
        //     rotateStringArray: true,
        //   },
        // },
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
  // plugins: [
  //   new JSObfuscator({
  //     rotateStringArray: true,
  //   }, []),
  // ],
};
