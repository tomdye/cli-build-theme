import CssModulePlugin from '@dojo/webpack-contrib/css-module-plugin/CssModulePlugin';
import * as fs from 'fs';
import * as path from 'path';
import { Compiler, Configuration, DefinePlugin } from 'webpack';

import { BuildArgs } from './interfaces';

const postcssPresetEnv = require('postcss-preset-env');
const postcssImport = require('postcss-import');
import * as MiniCssExtractPlugin from 'mini-css-extract-plugin';
const TemplatedPathPlugin = require('webpack/lib/TemplatedPathPlugin');
// const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

interface CssStyle {
	walkDecls(processor: (decl: { value: string }) => void): void;
}

function colorToColorMod(style: CssStyle) {
	style.walkDecls((decl) => {
		decl.value = decl.value.replace('color(', 'color-mod(');
	});
}

const postcssImportConfig = {
	filter: (path: string) => {
		return /.*variables(\.m)?\.css$/.test(path);
	},
	load: (filename: string, importOptions: any = {}) => {
		return fs.readFileSync(filename, 'utf8').replace('color(', 'color-mod(');
	},
	resolve: (id: string, basedir: string, importOptions: any = {}) => {
		if (importOptions.filter) {
			const result = importOptions.filter(id);
			if (!result) {
				return id;
			}
		}
		if (id[0] === '~') {
			return id.substr(1);
		}
		return id;
	}
};

const postcssPresetConfig = {
	browsers: ['last 2 versions', 'ie >= 10'],
	insertBefore: {
		'color-mod-function': colorToColorMod
	},
	features: {
		'color-mod-function': true,
		'nesting-rules': true
	},
	autoprefixer: {
		grid: true
	}
};

export default function webpackConfigFactory(args: BuildArgs): Configuration {
	const basePath = process.cwd();
	const packageJsonPath = path.join(basePath, 'package.json');
	const packageJson = fs.existsSync(packageJsonPath) ? require(packageJsonPath) : {};
	const themeName = args.name;
	const themeVersion = args.release || packageJson.version;
	const themePath = path.join(basePath, 'src', themeName);

	function recursiveIssuer(m: any): string | boolean {
		return m.issuer ? recursiveIssuer(m.issuer) : m.name ? m.name : false;
	}

	return {
		mode: 'production',
		entry: {
			[`${themeName}-custom-element`]: `imports-loader?theme=${path.join(themePath, 'index.ts')}!${path.join(
				'./template',
				'theme-installer.js'
			)}`,
			[themeName]: path.join(themePath, 'index.ts')
		},
		output: {
			filename: '[custom].js',
			path: path.join(basePath, `dist/src/${themeName}`),
			library: '[name]',
			libraryTarget: 'umd'
		},
		resolve: {
			modules: [basePath, path.join(basePath, 'node_modules')],
			extensions: ['.ts', '.js'],
			alias: {
				assets: path.resolve(basePath, 'assets')
			}
		},
		devtool: 'source-map',
		optimization: {
			splitChunks: {
				cacheGroups: {
					index: {
						name: 'index',
						test: (m, c, entry) => m.constructor.name === 'CssModule' && recursiveIssuer(m) === entry,
						chunks: 'all',
						enforce: true
					}
				}
			},
			minimizer: [
				new TerserPlugin({ sourceMap: true, cache: true })
				// ,
				// new OptimizeCssAssetsPlugin({
				// 	cssProcessor: require('cssnano'),
				// 	cssProcessorPluginOptions: {
				// 		preset: ['default', { calc: false }]
				// 	}
				// })
			]
		},
		plugins: [
			new CssModulePlugin(basePath),
			new DefinePlugin({ THEME_NAME: JSON.stringify(themeName) }),
			new MiniCssExtractPlugin({
				filename: `[name].css`
			}),
			new TemplatedPathPlugin(),
			function(this: Compiler) {
				const compiler = this;
				const elementName = `${themeName}-${themeVersion}`;
				const distName = 'index';
				compiler.hooks.compilation.tap('@dojo/cli-build-theme', (compilation) => {
					compilation.mainTemplate.plugin(
						'asset-path',
						(template: string, chunkData?: { chunk: { name?: string } }) => {
							const chunkName = chunkData && chunkData.chunk && chunkData.chunk.name;
							return template.indexOf('[custom]') > -1
								? template.replace(
										/\[custom\]/,
										chunkName === `${themeName}-custom-element` ? elementName : distName
								  )
								: template;
						}
					);
				});
			}
		],
		module: {
			rules: [
				{
					include: themePath,
					test: /.*\.ts?$/,
					use: [
						{
							loader: 'ts-loader',
							options: { instance: 'dojo', compilerOptions: { declaration: false } }
						}
					]
				},
				{
					include: themePath,
					test: /.*\.(gif|png|jpe?g|svg|eot|ttf|woff|woff2)$/i,
					loader: 'file-loader?hash=sha512&digest=hex&name=[hash:base64:8].[ext]',
					options: {
						outputPath: 'assets/',
						useRelativePath: true
					}
				},
				{
					include: themePath,
					test: /.*\.css?$/,
					use: [
						MiniCssExtractPlugin.loader,
						'@dojo/webpack-contrib/css-module-decorator-loader',
						{
							loader: 'css-loader',
							options: {
								modules: true,
								sourceMap: true,
								importLoaders: 1,
								localIdentName: '[name]__[local]__[hash:base64:5]'
							}
						},
						{
							loader: 'postcss-loader?sourceMap',
							options: {
								ident: 'postcss',
								plugins: [postcssImport(postcssImportConfig), postcssPresetEnv(postcssPresetConfig)]
							}
						}
					]
				}
			]
		}
	};
}
