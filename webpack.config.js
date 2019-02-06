// Copyright (c) 2014-2019, EagleView. All rights reserved.

const path = require('path');

module.exports = {
    entry: "./client/entry.tsx",
    mode: "none",
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "bundle.js"
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js"]
    },
    module: {
        rules: [
            { test: /\.css$/, use: ["style-loader", "css-loader"] },
            { test: /\.scss$/, use : ["style-loader", "css-loader", "sass-loader"] },
            { test: /\.png$/, use : "file-loader" },
            { test: /\.tsx?$/, use : "awesome-typescript-loader" }
        ]
    },
    devServer: {
        https: true,
        contentBase: path.resolve(__dirname, "client"),
        port: 8080,
        proxy: {
            '/api': 'http://localhost:9090'
        },
    },
    devtool: 'source-map'
};