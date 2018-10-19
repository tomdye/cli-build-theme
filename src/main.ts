import { Command, Helper, OptionsHelper } from '@dojo/cli/interfaces';
import * as spawn from 'cross-spawn';
import { copy } from 'cpx';
import * as ora from 'ora';
import { join } from 'path';
import * as rimraf from 'rimraf';
import * as webpack from 'webpack';
import { BuildArgs } from './interfaces';
import getConfig from './webpack.config';

const command: Command = {
	group: 'build',
	name: 'theme',
	description: 'create a distributable build of your Dojo theme',
	register(options: OptionsHelper) {
		options('name', {
			describe: 'The name of the theme. Used to set the filename of custom element-compatible builds.',
			alias: 'n'
		});

		options('release', {
			describe:
				'The version to use when generating custom element-compatible builds. Defaults to the package.json version.',
			alias: 'r'
		});
	},
	run(helper: Helper, args: BuildArgs) {
		const { name } = args;
		const basePath = process.cwd();
		const createTask = (callback: any) =>
			new Promise((resolve, reject) => {
				callback((error?: Error) => {
					if (error) {
						reject(error);
					}
					resolve();
				});
			});
		const createChildProcess = (command: string, args: string[], errorMessage: string) =>
			new Promise((resolve, reject) => {
				const child = spawn(join(basePath, 'node_modules', '.bin', command), args, { cwd: basePath });
				child.on('error', reject);
				child.on('exit', (code) => (code !== 0 ? reject(new Error(errorMessage)) : resolve()));
			});

		const spinner = ora(`building ${name} theme`).start();
		return createTask((callback: any) => rimraf(join('dist', 'src', name), callback))
			.then(() => createChildProcess('tcm', [join('src', name, '*.m.css')], 'Failed to build CSS modules'))
			.then(() =>
				createChildProcess('tsc', ['--outDir', join('dist', 'src', name)], `Failed to build ${name}/index.d.ts`)
			)
			.then(() =>
				createTask((callback: any) =>
					copy(join('src', name, '*.{d.ts,css}'), join('dist', 'src', name), callback)
				)
			)
			.then(() =>
				createTask((callback: any) => {
					const compiler = webpack(getConfig(args));
					compiler.run(callback);
				})
			)
			.then(
				() => {
					spinner.succeed('build successful');
				},
				(error) => {
					spinner.fail(error);
				}
			);
	}
};

export default command;
