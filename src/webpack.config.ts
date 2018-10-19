import CssModulePlugin from '@dojo/webpack-contrib/css-module-plugin/CssModulePlugin';
import * as fs from 'fs';
import * as path from 'path';
import { Chunk, Compiler, Configuration, DefinePlugin } from 'webpack';

import { BuildArgs } from './interfaces';

const postcssPresetEnv = require('postcss-preset-env');
const postcssImport = require('postcss-import');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const TemplatedPathPlugin = require('webpack/lib/TemplatedPathPlugin');

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

	return {
		entry: {
			[`${themeName}-custom-element`]: `imports-loader?theme=${path.join(themePath, 'index.ts')}!${path.join('./template', 'theme-installer.js')}`,
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
		plugins: [
			new CssModulePlugin(basePath),
			new DefinePlugin({ THEME_NAME: JSON.stringify(themeName) }),
			new UglifyJsPlugin({ sourceMap: true, cache: true }),
			new ExtractTextPlugin({
				filename: (getPath: (template: string) => string) => getPath('[custom].css')
			}),
			new TemplatedPathPlugin(),
			function (this: Compiler) {
				const compiler = this;
				const elementName = `${themeName}-${themeVersion}`;
				const distName = 'index';
				compiler.plugin('compilation', (compilation) => {
					compilation.mainTemplate.plugin('asset-path', (template: string, chunkData?: { chunk: Chunk }) => {
						const chunkName = chunkData && chunkData.chunk && chunkData.chunk.name;
						return template.indexOf('[custom]') > -1 ?
							template.replace(/\[custom\]/, chunkName === `${themeName}-custom-element` ? elementName : distName) :
							template;
					});
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
						publicPath: '/assets/'
					}
				},
				{
					include: themePath,
					test: /.*\.css?$/,
					use: ExtractTextPlugin.extract({
						fallback: ['style-loader'],
						use: [
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
					})
				}
			]
		}
	};
}

