const { describe, it, beforeEach, afterEach } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');
import { join, sep } from 'path';
import { SinonStub, stub, match } from 'sinon';
import MockModule from '../support/MockModule';

let mockModule: MockModule;
let mockSpinner: any;
let error: Error | null;
let tcmCode = 0 | 1;
let tscCode = 0 | 1;
let stats: any;
let runStub: SinonStub;
let exitStub: SinonStub;

function getMockConfiguration(config: any = {}) {
	return {
		configuration: {
			get() {
				return { ...config };
			}
		}
	};
}

describe('command', () => {
	beforeEach(() => {
		error = null;
		exitStub = stub(process, 'exit');
		stats = {
			toJson() {
				return 'stats';
			}
		};
		mockModule = new MockModule('../../src/main', require);
		mockModule.dependencies(['./webpack.config', 'cross-spawn', 'cpx', 'ora', 'rimraf', 'webpack']);
		runStub = stub().callsFake((callback: Function) => {
			callback(error, stats);
		});
		mockSpinner = {
			start: stub().returnsThis(),
			succeed: stub().returnsThis(),
			fail: stub().returnsThis()
		};
		tcmCode = 0;
		tscCode = 0;
		mockModule.getMock('cross-spawn').ctor.callsFake((commandPath: string) => ({
			on: stub().callsFake((name: string, callback: Function) => {
				if (name === 'exit') {
					const command = commandPath.split(sep).pop();
					const code = command === 'tsc' ? tscCode : command === 'tcm' ? tcmCode : 0;
					callback(code);
				}
			})
		}));
		mockModule.getMock('cpx').copy.callsFake((from: string, to: string, callback: Function) => {
			callback(null);
		});
		mockModule.getMock('rimraf').ctor.callsFake((dirname: string, callback: Function) => {
			callback(null);
		});
		mockModule.getMock('ora').ctor.returns(mockSpinner);
		mockModule.getMock('webpack').ctor.returns({
			run: runStub
		});
	});

	afterEach(() => {
		mockModule.destroy();
		exitStub.restore();
	});

	it('registers the command options', () => {
		const main = mockModule.getModuleUnderTest().default;
		const optionsStub = stub();
		main.register(optionsStub);
		assert.isTrue(
			optionsStub.calledWith('name', {
				describe: 'The name of the theme. Used to set the filename of custom element-compatible builds.',
				alias: 'n'
			})
		);
		assert.isTrue(
			optionsStub.calledWith('release', {
				describe:
					'The version to use when generating custom element-compatible builds. Defaults to the package.json version.',
				alias: 'r'
			})
		);
	});

	it('should generate the index.d.ts file', () => {
		const main = mockModule.getModuleUnderTest().default;
		return main.run(getMockConfiguration(), { name: 'my-theme' }).then(() => {
			const basePath = process.cwd();
			const command = join(basePath, 'node_modules/.bin/tsc');
			const spawn = mockModule.getMock('cross-spawn').ctor;
			assert.isTrue(
				spawn.calledWith(command, ['--outDir', join('dist', 'src', 'my-theme'), '--project', match.string], {
					cwd: basePath
				})
			);
		});
	});

	it('rejects if an error occurs', () => {
		error = new Error('failed!');
		const main = mockModule.getModuleUnderTest().default;
		return main.run(getMockConfiguration(), { name: 'my-theme' }).then(() => {
			assert.isTrue(mockSpinner.fail.called);
		});
	});

	it('shows a building spinner on start', () => {
		const main = mockModule.getModuleUnderTest().default;
		return main.run(getMockConfiguration(), { name: 'my-theme' }).then(() => {
			assert.isTrue(mockModule.getMock('ora').ctor.calledWith('building my-theme theme'));
			assert.isTrue(mockSpinner.start.called);
			assert.isTrue(mockSpinner.succeed.called);
		});
	});

	it('should clear the output directory', () => {
		const main = mockModule.getModuleUnderTest().default;
		return main.run(getMockConfiguration(), { name: 'my-theme' }).then(() => {
			assert.isTrue(mockModule.getMock('rimraf').ctor.calledWith(join('dist', 'src', 'my-theme')));
		});
	});

	it('should generate .m.css.d.ts files', () => {
		const main = mockModule.getModuleUnderTest().default;
		return main.run(getMockConfiguration(), { name: 'my-theme' }).then(() => {
			const basePath = process.cwd();
			const command = join(basePath, 'node_modules/.bin/tcm');
			const spawn = mockModule.getMock('cross-spawn').ctor;
			assert.isTrue(spawn.calledWith(command, ['-p=' + join('src', 'my-theme', '*.m.css')], { cwd: basePath }));
		});
	});

	it('should fail when .m.css.d.ts files cannot be generated', () => {
		tcmCode = 1;
		const main = mockModule.getModuleUnderTest().default;
		return main.run(getMockConfiguration(), { name: 'my-theme' }).then(() => {
			const { message } = mockSpinner.fail.args[0][0];
			assert.strictEqual(message, 'Failed to build CSS modules');
		});
	});

	it('should fail when the index.d.ts file cannot be generated', () => {
		tscCode = 1;
		const main = mockModule.getModuleUnderTest().default;
		return main.run(getMockConfiguration(), { name: 'my-theme' }).then(() => {
			const { message } = mockSpinner.fail.args[0][0];
			assert.strictEqual(message, 'Failed to build my-theme/index.d.ts');
		});
	});

	it('should copy d.ts and css files', () => {
		const main = mockModule.getModuleUnderTest().default;
		return main.run(getMockConfiguration(), { name: 'my-theme' }).then(() => {
			const { copy } = mockModule.getMock('cpx');
			assert.isTrue(copy.calledWith(join('src', 'my-theme', '*.{d.ts,css}'), join('dist', 'src', 'my-theme')));
		});
	});
});
