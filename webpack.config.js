const path = require("path");

module.exports = {
  entry: "./src/index.js",
  output: {
    filename: "main.js",
    path: path.resolve(__dirname, "dist")
  },
  devtool: "inline-source-map",
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: '/node_modules'
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@live2d': path.resolve(__dirname, 'live2d/framework/src')
    }
  }
}