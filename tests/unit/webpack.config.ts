const { describe, it, beforeEach, afterEach } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');
import { join, resolve } from 'path';
import { stub } from 'sinon';
import MockModule from '../support/MockModule';

let mockModule: MockModule;

describe('webpack.config', () => {
	beforeEach(() => {
		mockModule = new MockModule('../../src/webpack.config', require);
		mockModule.dependencies([
			'@dojo/webpack-contrib/css-module-plugin/CssModulePlugin',
			'extract-text-webpack-plugin',
			'uglifyjs-webpack-plugin',
			'webpack/lib/TemplatedPathPlugin',
			'webpack'
		]);
		mockModule.getMock('webpack').ctor.DefinePlugin = stub();
		mockModule.getMock('extract-text-webpack-plugin').ctor.extract = stub();
	});

	afterEach(() => {
		mockModule.destroy();
	});

	it('should generate both a custom element and generic build', () => {
		const factory = mockModule.getModuleUnderTest().default;
		const config = factory({ name: 'my-theme' });
		const themePath = join(process.cwd(), 'src/my-theme');
		assert.deepEqual(config.entry, {
			'my-theme-custom-element': `imports-loader?theme=${join(themePath, 'index.ts')}!${join(
				'./template',
				'theme-installer.js'
			)}`,
			'my-theme': join(themePath, 'index.ts')
		});
	});

	it('should output to dist/src/{theme name}', () => {
		const factory = mockModule.getModuleUnderTest().default;
		const config = factory({ name: 'my-theme' });
		assert.deepEqual(config.output, {
			filename: '[custom].js',
			path: join(process.cwd(), 'dist/src/my-theme'),
			library: '[name]',
			libraryTarget: 'umd'
		});
	});

	it('should output assets to the `assets/` directory', () => {
		const factory = mockModule.getModuleUnderTest().default;
		const config = factory({ name: 'my-theme' });
		assert.deepEqual(config.resolve, {
			modules: [process.cwd(), join(process.cwd(), 'node_modules')],
			extensions: ['.ts', '.js'],
			alias: {
				assets: resolve(process.cwd(), 'assets')
			}
		});
	});

	it('should output a single CSS file', () => {
		const factory = mockModule.getModuleUnderTest().default;
		const ExtractTextPlugin = mockModule.getMock('extract-text-webpack-plugin').ctor;
		const getPath = stub();

		factory({ name: 'my-theme' });

		const resolveCss = ExtractTextPlugin.args[0][0].filename;
		resolveCss(getPath);
		assert.isTrue(getPath.calledWith('[custom].css'));
	});

	it('should output source maps', () => {
		const factory = mockModule.getModuleUnderTest().default;
		const config = factory({ name: 'my-theme' });
		assert.strictEqual(config.devtool, 'source-map');
	});

	it('should output an index.js file', () => {
		const factory = mockModule.getModuleUnderTest().default;
		const config = factory({ name: 'my-theme', release: '1.1.1' });
		const outputFileNamePlugin = config.plugins[config.plugins.length - 1];
		const mainTemplatePlugin = stub();
		const mockPlugin = stub().callsFake((name: string, callback: Function) => {
			if (name === 'asset-path') {
				mainTemplatePlugin(
					callback('[custom].js', {
						chunk: { name: 'my-theme' }
					})
				);
			} else if (name === 'compilation') {
				callback({
					mainTemplate: { plugin: mockPlugin }
				});
			}
		});
		outputFileNamePlugin.apply({ plugin: mockPlugin });
		assert.isTrue(mainTemplatePlugin.calledWith('index.js'));
	});

	it('should output a custom element file named `{themeName}-{version}.js`', () => {
		const factory = mockModule.getModuleUnderTest().default;
		const config = factory({ name: 'my-theme', release: '1.1.1' });
		const outputFileNamePlugin = config.plugins[config.plugins.length - 1];
		const mainTemplatePlugin = stub();
		const mockPlugin = stub().callsFake((name: string, callback: Function) => {
			if (name === 'asset-path') {
				mainTemplatePlugin(
					callback('[custom].js', {
						chunk: { name: 'my-theme-custom-element' }
					})
				);
			} else if (name === 'compilation') {
				callback({
					mainTemplate: { plugin: mockPlugin }
				});
			}
		});
		outputFileNamePlugin.apply({ plugin: mockPlugin });
		assert.isTrue(mainTemplatePlugin.calledWith('my-theme-1.1.1.js'));
	});
});
