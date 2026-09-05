import path from "path";

const config = {
  entry: "./src/content.ts",
  mode: "production",
  target: "web",
  output: {
    path: path.resolve("dist"),
    filename: "main.js",
  },
  resolve: {
    extensions: [".ts", ".js"],
    // Sources use extensionless-safe ESM imports ("./shade.js"); map those back to .ts.
    extensionAlias: {
      ".js": [".ts", ".js"],
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: "ts-loader",
          // The project tsconfig is type-check only; the bundle needs real output.
          options: {
            compilerOptions: {
              noEmit: false,
            },
          },
        },
      },
    ],
  },
};

export default () => config;
