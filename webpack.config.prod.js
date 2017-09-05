import path from 'path';
import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import WebpackMd5Hash from 'webpack-md5-hash';

export default {
	devtool: 'source-map',
	entry: {
		vendor: path.resolve(__dirname, 'src', 'js', 'vendor.js'),
		app: path.resolve(__dirname, 'src', 'js', 'app.js')
	},
	target: 'web',
	output: {
		path: path.resolve(__dirname, 'dist'),
		publicPath: '/',
		filename: '[name].[chunkhash].js'
	},
	plugins: [
		new webpack.ProvidePlugin({
            '$': 'jquery'
		}),
		// Hash the files using MD5 so that their names change when the content changes.
		new WebpackMd5Hash(),
		// Use CommonsChunkPlugin to create a sepreate bundle of vendor libraries
		new webpack.optimize.CommonsChunkPlugin({
			name: 'vendor'
		}),
		// Create HTML file that includes reference to bundled JS.
		new HtmlWebpackPlugin({
			template: 'src/index.html',
			minify: {
				removeComments: true,
				collapseWhitespace: true,
				removeRedundantAttributes: true,
				useShortDoctype: true,
				removeEmptyAttributes: true,
				removeStyleLinkTypeAttributes: true,
				keepClosingSlash: true,
				minifyJS: true,
				minifyCSS: true,
				minifyURLs: true
			},
			inject: true
		}),
		// Minify JS
		new webpack.optimize.UglifyJsPlugin()
	],
	module: {
		rules: [
			{
				test: /\.js$/,
				exclude: /node_modules/,
				use: ['babel-loader', 'eslint-loader']
			},
			{
				test: /\.less$/,
				use: [
					{ loader: 'style-loader' },
					{
						loader: "css-loader",
						options: { url: false }
					},
					{ loader: 'less-loader' }
				]
			}
		]
	}
}